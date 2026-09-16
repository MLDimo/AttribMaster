-- Jusqu'ici project_members n'avait qu'un seul rôle implicite : "lecture
-- seule" (voir 0004_project_members.sql). On ajoute un vrai rôle par ligne
-- pour permettre à un owner/admin du projet de promouvoir un collaborateur
-- en "owner" du projet (accès de gestion complet sur CE projet, comme un
-- owner/admin de workspace, mais sans les droits au niveau workspace :
-- facturation du workspace, autres projets, membres du workspace).
--
-- Un project_members.role = 'owner' est donc reconnu par
-- hasProjectManageAccess() au même titre qu'un owner/admin de workspace
-- (voir lib/projects/repository.ts).
alter table project_members
  add column if not exists role text not null default 'read' check (role in ('read', 'owner'));
