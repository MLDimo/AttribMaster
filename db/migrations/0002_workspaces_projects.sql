-- Comptes ("workspaces") & projets multi-tenant.
--
-- Relations :
--   - un workspace peut avoir plusieurs projets (workspaces <-> projects)
--   - un projet peut être partagé par plusieurs workspaces (many-to-many, ex: agence + client)
--   - un projet = une seule connexion BigQuery
--   - un workspace peut avoir plusieurs membres (utilisateurs)
--
-- Pas de RLS ici (pas de couche PostgREST/JWT côté DB comme avec Supabase) :
-- l'autorisation est vérifiée explicitement dans le code applicatif
-- (jointures sur workspace_members à chaque requête, voir lib/projects/repository.ts).

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Renseignés à l'étape 2 (connexion BigQuery), null tant qu'elle n'est pas faite.
  gcp_project_id text,
  ga4_dataset text,
  bigquery_dataset text not null default 'attribution',
  -- Refresh token OAuth Google (scopes BigQuery), chiffré en app (AES-256-GCM,
  -- voir lib/crypto/secrets.ts) — jamais stocké en clair.
  oauth_refresh_token_encrypted text,
  created_by uuid references users (id),
  created_at timestamptz not null default now()
);

-- Table de jonction many-to-many entre workspaces et projets.
create table if not exists workspace_projects (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, project_id)
);

create index if not exists workspace_members_user_id_idx on workspace_members (user_id);
create index if not exists workspace_projects_project_id_idx on workspace_projects (project_id);

-- À l'inscription : créer un workspace par défaut + l'appartenance "owner",
-- pour que l'utilisateur ait immédiatement un espace de travail.
create or replace function handle_new_user()
returns trigger
language plpgsql
as $$
declare
  v_workspace_id uuid;
begin
  insert into workspaces (name)
  values (coalesce(new.name, new.email) || ' — Espace personnel')
  returning id into v_workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_user_created on users;
create trigger on_user_created
  after insert on users
  for each row execute function handle_new_user();
