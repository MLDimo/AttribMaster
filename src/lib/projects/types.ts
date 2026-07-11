export type PlanId = "standard" | "pro" | "custom";
export type BillingInterval = "monthly" | "annual";

export type Project = {
  id: string;
  name: string;
  gcp_project_id: string | null;
  ga4_dataset: string | null;
  bigquery_dataset: string;
  oauth_refresh_token_encrypted: string | null;
  created_by: string | null;
  created_at: string;
  billing_account_id: string | null;
  plan: PlanId | null;
  billing_interval: BillingInterval | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
};

/** Un projet est utilisable (requêtes BigQuery) une fois la connexion faite. */
export function isProjectConnected(project: Project): boolean {
  return Boolean(project.gcp_project_id && project.ga4_dataset && project.oauth_refresh_token_encrypted);
}

/** Un projet n'est pleinement actif que si son abonnement est en cours (Stripe). */
export function isProjectSubscribed(project: Project): boolean {
  return project.subscription_status === "active" || project.subscription_status === "trialing";
}

export type Account = {
  id: string;
  name: string;
  created_at: string;
};

export type ProjectMember = {
  user_id: string;
  name: string | null;
  email: string;
  image: string | null;
  created_at: string;
};

export type BillingAccount = {
  id: string;
  workspace_id: string;
  name: string;
  stripe_customer_id: string | null;
  created_at: string;
};
