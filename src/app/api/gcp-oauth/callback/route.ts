import { NextRequest, NextResponse } from "next/server";

import { exchangeCodeForRefreshToken } from "@/lib/gcp-oauth/client";
import { isValidNonce, OAUTH_STATE_COOKIE, parseOAuthState } from "@/lib/gcp-oauth/state";
import { getProject, setProjectOAuthToken } from "@/lib/projects/repository";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const rawState = request.nextUrl.searchParams.get("state");
  const googleError = request.nextUrl.searchParams.get("error");

  const parsedState = rawState ? parseOAuthState(rawState) : null;
  if (!parsedState) {
    return NextResponse.json({ error: "Missing or malformed state" }, { status: 400 });
  }
  const { projectId, nonce } = parsedState;

  const connectUrl = new URL(`/projects/${projectId}/connect`, request.nextUrl.origin);
  const redirectWithError = (errorCode: string) => {
    connectUrl.searchParams.set("error", errorCode);
    const response = NextResponse.redirect(connectUrl);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  };

  // Anti-CSRF : le nonce du state doit correspondre au cookie posé par /start
  // dans CE navigateur — un lien de callback forgé par un tiers ne l'a pas.
  if (!isValidNonce(nonce, request.cookies.get(OAUTH_STATE_COOKIE)?.value)) {
    return redirectWithError("state_mismatch");
  }

  if (googleError) {
    return redirectWithError(googleError);
  }
  if (!code) {
    return redirectWithError("missing_code");
  }

  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found or not accessible" }, { status: 404 });
  }

  try {
    const refreshToken = await exchangeCodeForRefreshToken(request.nextUrl.origin, code);
    await setProjectOAuthToken(projectId, refreshToken);
  } catch (error) {
    console.error("[gcp-oauth/callback]", error);
    return redirectWithError("token_exchange_failed");
  }

  const response = NextResponse.redirect(connectUrl);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
