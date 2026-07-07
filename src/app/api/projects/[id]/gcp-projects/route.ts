import { NextResponse } from "next/server";

import { listAccessibleGcpProjects } from "@/lib/gcp-oauth/discovery";
import { getProject, getProjectOAuthToken } from "@/lib/projects/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found or not accessible" }, { status: 404 });
  }

  const refreshToken = await getProjectOAuthToken(id);
  if (!refreshToken) {
    return NextResponse.json({ error: "BigQuery not connected yet" }, { status: 400 });
  }

  try {
    const projects = await listAccessibleGcpProjects(refreshToken);
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("[api/projects/[id]/gcp-projects]", error);
    return NextResponse.json({ error: "Failed to list GCP projects" }, { status: 500 });
  }
}
