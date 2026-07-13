import { NextResponse } from "next/server";

import { auth } from "@/auth";

// Comparaison exacte (pas de préfixe) : "/" ne doit pas rendre tout le site public.
const PUBLIC_PATHS = ["/", "/login", "/mentions-legales", "/cgu", "/cgv"];

export default auth((request) => {
  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);
  const isApiPath = request.nextUrl.pathname.startsWith("/api");

  if (!request.auth && !isPublicPath && !isApiPath) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
