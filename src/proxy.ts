import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { shouldRedirectToLogin } from "@/lib/auth/public-paths";

export default auth((request) => {
  if (shouldRedirectToLogin(request.nextUrl.pathname, Boolean(request.auth))) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
