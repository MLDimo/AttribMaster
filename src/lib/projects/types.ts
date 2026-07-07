export type Project = {
  id: string;
  name: string;
  gcp_project_id: string | null;
  ga4_dataset: string | null;
  bigquery_dataset: string;
  oauth_refresh_token_encrypted: string | null;
  created_by: string | null;
  created_at: string;
};

/** Un projet est utilisable (requêtes BigQuery) une fois la connexion faite. */
export function isProjectConnected(project: Project): boolean {
  return Boolean(project.gcp_project_id && project.ga4_dataset && project.oauth_refresh_token_encrypted);
}

export type Account = {
  id: string;
  name: string;
  created_at: string;
};
