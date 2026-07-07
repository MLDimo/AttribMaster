import { NextRequest, NextResponse } from "next/server";

import { buildConsentUrl } from "@/lib/gcp-oauth/client";
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

  const consentUrl = buildConsentUrl(request.nextUrl.origin, projectId);
  return NextResponse.redirect(consentUrl);
}
