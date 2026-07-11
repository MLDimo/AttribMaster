-- Abonnements Stripe : 1 projet = 1 abonnement (facturation), rattaché à un
-- "compte de facturation" (client Stripe) qui peut être réutilisé entre
-- plusieurs projets d'un même workspace.
create table if not exists billing_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name text not null,
  stripe_customer_id text unique,
  created_by uuid references users (id),
  created_at timestamptz not null default now()
);

create index if not exists billing_accounts_workspace_id_idx on billing_accounts (workspace_id);

alter table projects add column if not exists billing_account_id uuid references billing_accounts (id);
alter table projects add column if not exists plan text check (plan in ('standard', 'pro', 'custom'));
alter table projects add column if not exists billing_interval text check (billing_interval in ('monthly', 'annual'));
alter table projects add column if not exists stripe_subscription_id text unique;
-- Statut brut renvoyé par Stripe (active, trialing, past_due, canceled, incomplete, ...),
-- synchronisé via webhook. Le projet n'est utilisable que si 'active' ou 'trialing'.
alter table projects add column if not exists subscription_status text;

-- Demandes de contact pour le plan "Sur mesure" (pas de paiement en ligne, tarif négocié).
create table if not exists custom_plan_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects (id) on delete set null,
  user_id uuid references users (id),
  name text not null,
  email text not null,
  company text,
  message text,
  created_at timestamptz not null default now()
);
