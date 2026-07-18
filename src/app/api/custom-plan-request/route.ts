import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createCustomPlanRequest } from "@/lib/billing/repository";
import { apiErrorResponse } from "@/lib/auth/errors";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  projectId: z.string().uuid().nullable(),
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  company: z.string().trim().optional(),
  message: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  // Formulaire public : sans limite, un bot peut remplir la table à volonté.
  if (!(await checkRateLimit(`cpr:${clientIp(request)}`, 5, 60))) {
    return NextResponse.json({ error: "Trop de demandes, réessaie plus tard." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await createCustomPlanRequest(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "[api/custom-plan-request POST]", "Failed to submit request");
  }
}
