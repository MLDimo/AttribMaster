import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/auth/errors";
import { resetPassword } from "@/lib/auth/password-reset";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().trim().email(),
  token: z.string().min(1),
  password: z.string().min(8).max(200),
});

export async function POST(request: NextRequest) {
  // Empêche de brute-forcer un token de reset (déjà 256 bits, mais autant
  // fermer la porte).
  if (!(await checkRateLimit(`reset:${clientIp(request)}`, 10, 60))) {
    return NextResponse.json({ error: "Trop de tentatives, réessaie plus tard." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const ok = await resetPassword(parsed.data.email, parsed.data.token, parsed.data.password);
    if (!ok) {
      return NextResponse.json(
        { error: "Lien invalide ou expiré. Refais une demande de réinitialisation." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "[api/auth/reset-password POST]", "Failed to reset password");
  }
}
