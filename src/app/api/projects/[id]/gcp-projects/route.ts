import { NextResponse } from "next/server";

import { listAccessibleGcpProjects } from "@/lib/gcp-oauth/discovery";
import { getProject, getProjectOAuthToken, requireProjectAccess, requireUserId } from "@/lib/projects/repository";
import { apiErrorResponse } from "@/lib/auth/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Fait partie du flux de connexion (gestion) : utilise le VRAI token
    // OAuth du projet pour interroger Google. Un collaborateur en lecture
    // seule n'a rien à faire ici, même si la réponse ne contient "que" une
    // liste — elle révèle la structure GCP réelle du compte connecté.
    const userId = await requireUserId();
    await requireProjectAccess(id, userId);

    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found or not accessible" }, { status: 404 });
    }

    const refreshToken = await getProjectOAuthToken(id);
    if (!refreshToken) {
      return NextResponse.json({ error: "BigQuery not connected yet" }, { status: 400 });
    }

    const projects = await listAccessibleGcpProjects(refreshToken);
    return NextResponse.json({ projects });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/gcp-projects]", "Failed to list GCP projects");
  }
}
