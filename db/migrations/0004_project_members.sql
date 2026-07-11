-- Collaborateurs ajoutés directement sur un projet (par email), en plus de
-- l'accès hérité via workspace_projects/workspace_members. Gérable depuis la
-- barre latérale du projet : liste, ajout par email, suppression.
create table if not exists project_members (
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  added_by uuid references users (id),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_id_idx on project_members (user_id);
