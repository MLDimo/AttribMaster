import { NextRequest, NextResponse } from "next/server";

import { buildConsentUrl } from "@/lib/gcp-oauth/client";
import { createOAuthNonce, OAUTH_STATE_COOKIE, packOAuthState } from "@/lib/gcp-oauth/state";
import { getProject } from "@/lib/projects/repository";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found or not accessible" }, { status: 404 });
  }

  const nonce = createOAuthNonce();
  const consentUrl = buildConsentUrl(request.nextUrl.origin, packOAuthState(projectId, nonce));
  const response = NextResponse.redirect(consentUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // le code OAuth Google expire de toute façon en ~10 min
    path: "/api/gcp-oauth",
  });
  return response;
}
