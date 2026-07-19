import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/auth/errors";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(request: NextRequest) {
  // Limité par IP ET par email ciblé : sans le second, une seule IP pourrait
  // inonder la boîte mail d'un tiers de liens de réinitialisation.
  if (!(await checkRateLimit(`forgot:${clientIp(request)}`, 5, 60))) {
    return NextResponse.json({ error: "Trop de demandes, réessaie plus tard." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  if (!(await checkRateLimit(`forgot-target:${email}`, 3, 60))) {
    return NextResponse.json({ error: "Trop de demandes, réessaie plus tard." }, { status: 429 });
  }

  try {
    await requestPasswordReset(email, request.nextUrl.origin);
    // Toujours la même réponse, que le compte existe ou non (anti-énumération).
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "[api/auth/forgot-password POST]", "Failed to process request");
  }
}
