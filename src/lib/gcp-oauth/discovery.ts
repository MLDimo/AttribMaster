import { BigQuery } from "@google-cloud/bigquery";

import { authorizedClientFromRefreshToken } from "./client";

export type GcpProjectOption = {
  projectId: string;
  displayName: string;
};

/** Liste les projets GCP auxquels l'utilisateur OAuth a accès (Resource Manager v3). */
export async function listAccessibleGcpProjects(
  refreshToken: string
): Promise<GcpProjectOption[]> {
  const authClient = authorizedClientFromRefreshToken(refreshToken);
  const res = await authClient.request<{
    projects?: Array<{ projectId: string; displayName?: string; state?: string }>;
  }>({
    url: "https://cloudresourcemanager.googleapis.com/v3/projects:search",
  });

  return (res.data.projects ?? [])
    .filter((p) => p.state === "ACTIVE")
    .map((p) => ({ projectId: p.projectId, displayName: p.displayName ?? p.projectId }));
}

export type BigQueryDatasetOption = {
  id: string;
  /** Correspond au motif d'export natif GA4 (`analytics_<property_id>`). */
  likelyGa4Export: boolean;
};

/** Liste les datasets BigQuery d'un projet GCP donné. */
export async function listBigQueryDatasets(
  refreshToken: string,
  gcpProjectId: string
): Promise<BigQueryDatasetOption[]> {
  const authClient = authorizedClientFromRefreshToken(refreshToken);
  const bigquery = new BigQuery({ projectId: gcpProjectId, authClient });
  const [datasets] = await bigquery.getDatasets();

  return datasets
    .map((d) => d.id)
    .filter((id): id is string => Boolean(id))
    .map((id) => ({ id, likelyGa4Export: /^analytics_\d+$/.test(id) }));
}
