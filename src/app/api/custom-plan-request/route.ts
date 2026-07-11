import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createCustomPlanRequest } from "@/lib/billing/repository";

const bodySchema = z.object({
  projectId: z.string().uuid().nullable(),
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  company: z.string().trim().optional(),
  message: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await createCustomPlanRequest(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/custom-plan-request POST]", error);
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }
}
