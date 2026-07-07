import { BigQuery } from "@google-cloud/bigquery";

import { authorizedClientFromRefreshToken } from "@/lib/gcp-oauth/client";
import { getProject, getProjectAsService, getProjectOAuthToken } from "@/lib/projects/repository";
import type { Project } from "@/lib/projects/types";

export const ATTRIBUTIONS_TABLE = "attributions_resumees";

export type ProjectBigQuery = {
  client: BigQuery;
  project: Project;
};

/**
 * V2 : une connexion BigQuery par projet, authentifiée via le refresh token
 * OAuth Google (scopes BigQuery) déchiffré (AES-256-GCM) — aucune clé de
 * service à saisir manuellement. L'accès au projet est vérifié explicitement
 * (jointure workspace_members) lors du chargement de `project`.
 */
export async function getBigQueryClientForProject(projectId: string): Promise<ProjectBigQuery> {
  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Project not found or not accessible: ${projectId}`);
  }
  return buildClient(project);
}

/**
 * Variante sans session utilisateur (sans vérification d'accès), pour le
 * script de nuit qui tourne en tâche de fond sans requête HTTP authentifiée.
 */
export async function getBigQueryClientForProjectAsService(
  projectId: string
): Promise<ProjectBigQuery> {
  const project = await getProjectAsService(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }
  return buildClient(project);
}

async function buildClient(project: Project): Promise<ProjectBigQuery> {
  if (!project.gcp_project_id) {
    throw new Error(`Project not connected to BigQuery yet: ${project.id}`);
  }

  const refreshToken = await getProjectOAuthToken(project.id);
  if (!refreshToken) {
    throw new Error(`No BigQuery connection configured for project: ${project.id}`);
  }

  const authClient = authorizedClientFromRefreshToken(refreshToken);
  const client = new BigQuery({
    projectId: project.gcp_project_id,
    authClient,
  });

  return { client, project };
}
