import { NextRequest, NextResponse } from "next/server";

import { exchangeCodeForRefreshToken } from "@/lib/gcp-oauth/client";
import { getProject, setProjectOAuthToken } from "@/lib/projects/repository";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const projectId = request.nextUrl.searchParams.get("state");
  const googleError = request.nextUrl.searchParams.get("error");

  if (!projectId) {
    return NextResponse.json({ error: "Missing state (projectId)" }, { status: 400 });
  }

  const connectUrl = new URL(`/projects/${projectId}/connect`, request.nextUrl.origin);

  if (googleError) {
    connectUrl.searchParams.set("error", googleError);
    return NextResponse.redirect(connectUrl);
  }

  if (!code) {
    connectUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(connectUrl);
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
    connectUrl.searchParams.set("error", "token_exchange_failed");
    return NextResponse.redirect(connectUrl);
  }

  return NextResponse.redirect(connectUrl);
}
