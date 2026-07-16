import { NextRequest, NextResponse } from "next/server";

import { listBigQueryDatasets } from "@/lib/gcp-oauth/discovery";
import { getProject, getProjectOAuthToken } from "@/lib/projects/repository";
import { apiErrorResponse } from "@/lib/auth/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gcpProjectId = request.nextUrl.searchParams.get("gcpProjectId");
  if (!gcpProjectId) {
    return NextResponse.json({ error: "Missing gcpProjectId" }, { status: 400 });
  }

  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found or not accessible" }, { status: 404 });
    }

    const refreshToken = await getProjectOAuthToken(id);
    if (!refreshToken) {
      return NextResponse.json({ error: "BigQuery not connected yet" }, { status: 400 });
    }

    const datasets = await listBigQueryDatasets(refreshToken, gcpProjectId);
    return NextResponse.json({ datasets });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/gcp-datasets]", "Failed to list BigQuery datasets");
  }
}
