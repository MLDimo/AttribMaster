-- Invitation d'un collaborateur qui n'a pas encore de compte AttribMaster :
-- au lieu d'échouer (voir l'ancien ProjectMemberUserNotFoundError), on
-- mémorise l'invitation et un email est envoyé. Elle se transforme en accès
-- réel (project_members) automatiquement dès qu'un compte est créé avec cet
-- email — que ce soit par inscription email/mot de passe ou Google OAuth,
-- via le trigger handle_new_user ci-dessous (le même qui crée déjà le
-- workspace personnel de tout nouvel utilisateur, voir 0002_workspaces_projects.sql).
create table if not exists project_member_invites (
  project_id uuid not null references projects (id) on delete cascade,
  email text not null,
  role text not null default 'read' check (role in ('read', 'owner')),
  invited_by uuid references users (id),
  created_at timestamptz not null default now(),
  primary key (project_id, email)
);

create index if not exists project_member_invites_email_idx on project_member_invites (lower(email));

-- Remplace handle_new_user (0002) : ajoute la conversion des invitations en
-- attente, sans toucher au trigger lui-même (create or replace suffit).
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

  -- Toute invitation en attente pour cet email devient un accès réel, avec
  -- le rôle qui avait été fixé à l'invitation (read ou owner).
  insert into project_members (project_id, user_id, added_by, role)
  select pmi.project_id, new.id, pmi.invited_by, pmi.role
  from project_member_invites pmi
  where lower(pmi.email) = lower(new.email)
  on conflict (project_id, user_id) do nothing;

  delete from project_member_invites where lower(email) = lower(new.email);

  return new;
end;
$$;
