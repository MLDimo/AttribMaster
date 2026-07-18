import { NextRequest, NextResponse } from "next/server";

import { verifyEmailToken } from "@/lib/auth/registration";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const token = request.nextUrl.searchParams.get("token");

  const loginUrl = new URL("/login", request.nextUrl.origin);
  if (!email || !token) {
    loginUrl.searchParams.set("verified", "invalid");
    return NextResponse.redirect(loginUrl);
  }

  const ok = await verifyEmailToken(email, token);
  loginUrl.searchParams.set("verified", ok ? "1" : "invalid");
  return NextResponse.redirect(loginUrl);
}
