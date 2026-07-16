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

/**
 * Premier jour disponible dans l'export GA4 -> BigQuery (table journalière la
 * plus ancienne), pour rattraper tout l'historique à la connexion d'un
 * projet. `events_intraday_*` est exclu par le regex (jour en cours, pas
 * encore finalisé). Retourne null si le dataset est vide (projet flambant
 * neuf sans aucun export encore reçu).
 */
export async function discoverGa4HistoryStartDate(
  client: BigQuery,
  gcpProjectId: string,
  ga4Dataset: string
): Promise<string | null> {
  const [rows] = await client.query({
    query: `
      SELECT MIN(PARSE_DATE('%Y%m%d', REGEXP_EXTRACT(table_name, r'^events_(\\d{8})$'))) AS min_date
      FROM \`${gcpProjectId}.${ga4Dataset}.INFORMATION_SCHEMA.TABLES\`
      WHERE REGEXP_CONTAINS(table_name, r'^events_\\d{8}$')
    `,
  });
  const minDate = rows[0]?.min_date;
  if (!minDate) return null;
  return typeof minDate === "string" ? minDate : minDate.value;
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
