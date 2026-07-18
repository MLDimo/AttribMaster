import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/auth/errors";
import { EmailAlreadyUsedError, registerUser } from "@/lib/auth/registration";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
});

export async function POST(request: NextRequest) {
  // Endpoint public : sans limite, un bot peut créer des comptes en masse.
  if (!(await checkRateLimit(`signup:${clientIp(request)}`, 5, 60))) {
    return NextResponse.json({ error: "Trop de tentatives, réessaie plus tard." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await registerUser(
      parsed.data.name,
      parsed.data.email,
      parsed.data.password,
      request.nextUrl.origin
    );
    return NextResponse.json({ ok: true, autoVerified: result.autoVerified }, { status: 201 });
  } catch (error) {
    if (error instanceof EmailAlreadyUsedError) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email. Connecte-toi plutôt." },
        { status: 409 }
      );
    }
    return apiErrorResponse(error, "[api/auth/register POST]", "Failed to create account");
  }
}
