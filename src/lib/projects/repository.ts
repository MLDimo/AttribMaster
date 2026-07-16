import { auth } from "@/auth";
import { NotAuthorizedError, UnauthenticatedError } from "@/lib/auth/errors";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { getDbPool } from "@/lib/db/client";
import type { Account, Project, ProjectMember } from "./types";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthenticatedError();
  return session.user.id;
}

export async function isOwnerOrAdmin(workspaceId: string, userId: string): Promise<boolean> {
  const db = getDbPool();
  const { rows } = await db.query(
    `select 1 from workspace_members where workspace_id = $1 and user_id = $2 and role in ('owner', 'admin')`,
    [workspaceId, userId]
  );
  return rows.length > 0;
}

export async function listMyAccounts(): Promise<Account[]> {
  const userId = await requireUserId();
  const db = getDbPool();
  const { rows } = await db.query<Account>(
    `select w.* from workspaces w
     join workspace_members wm on wm.workspace_id = w.id
     where wm.user_id = $1
     order by w.name`,
    [userId]
  );
  return rows;
}

/** Un utilisateur a accès à un projet via son workspace, ou via un ajout direct (project_members). */
const ACCESSIBLE_PROJECTS_WHERE = `
  exists (
    select 1 from workspace_projects wp
    join workspace_members wm on wm.workspace_id = wp.workspace_id
    where wp.project_id = p.id and wm.user_id = $1
  )
  or exists (
    select 1 from project_members pm where pm.project_id = p.id and pm.user_id = $1
  )
`;

export async function listAccessibleProjects(): Promise<Project[]> {
  const userId = await requireUserId();
  const db = getDbPool();
  const { rows } = await db.query<Project>(
    `select distinct p.* from projects p
     where ${ACCESSIBLE_PROJECTS_WHERE}
     order by p.name`,
    [userId]
  );
  return rows;
}

/** Retourne le projet seulement si l'utilisateur courant y a accès (via un workspace ou un ajout direct). */
export async function getProject(projectId: string): Promise<Project | null> {
  const userId = await requireUserId();
  const db = getDbPool();
  const { rows } = await db.query<Project>(
    `select distinct p.* from projects p
     where p.id = $2 and (${ACCESSIBLE_PROJECTS_WHERE})`,
    [userId, projectId]
  );
  return rows[0] ?? null;
}

/** Sans vérification d'accès : réservé aux contextes serveur-à-serveur (cron). */
export async function getProjectAsService(projectId: string): Promise<Project | null> {
  const db = getDbPool();
  const { rows } = await db.query<Project>(`select * from projects where id = $1`, [projectId]);
  return rows[0] ?? null;
}

/** Workspace "principal" d'un projet (le premier rattaché) : utile pour y créer un compte de facturation. */
export async function getProjectPrimaryWorkspaceId(projectId: string): Promise<string | null> {
  const db = getDbPool();
  const { rows } = await db.query<{ workspace_id: string }>(
    `select workspace_id from workspace_projects where project_id = $1 order by created_at asc limit 1`,
    [projectId]
  );
  return rows[0]?.workspace_id ?? null;
}

/** Sans vérification d'accès : liste tous les projets configurés, pour le script de nuit. */
export async function listAllProjectsAsService(): Promise<Project[]> {
  const db = getDbPool();
  const { rows } = await db.query<Project>(`select * from projects order by name`);
  return rows;
}

export type CreateProjectInput = {
  name: string;
  accountId: string;
};

/** Étape 1 : juste le nom + le compte, sans connexion BigQuery. */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const userId = await requireUserId();
  if (!(await isOwnerOrAdmin(input.accountId, userId))) {
    throw new NotAuthorizedError("account");
  }

  const db = getDbPool();
  const { rows: projectRows } = await db.query<Project>(
    `insert into projects (name, created_by) values ($1, $2) returning *`,
    [input.name, userId]
  );
  const project = projectRows[0];

  await db.query(
    `insert into workspace_projects (workspace_id, project_id) values ($1, $2)`,
    [input.accountId, project.id]
  );

  return project;
}

export async function requireProjectAccess(projectId: string, userId: string): Promise<void> {
  const db = getDbPool();
  const { rows } = await db.query(
    `select 1 from workspace_projects wp
     join workspace_members wm on wm.workspace_id = wp.workspace_id
     where wp.project_id = $1 and wm.user_id = $2 and wm.role in ('owner', 'admin')`,
    [projectId, userId]
  );
  if (rows.length === 0) throw new NotAuthorizedError("project");
}

/** Étape 2 : stocke le refresh token OAuth obtenu depuis Google (chiffré, jamais en clair en base). */
export async function setProjectOAuthToken(projectId: string, refreshToken: string): Promise<void> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const db = getDbPool();
  await db.query(`update projects set oauth_refresh_token_encrypted = $1 where id = $2`, [
    encryptSecret(refreshToken),
    projectId,
  ]);
}

export type ConnectBigQueryInput = {
  gcpProjectId: string;
  ga4Dataset: string;
  bigqueryDataset?: string;
};

/** Étape 2 (suite) : finalise la connexion une fois le projet/dataset choisis. */
export async function connectProjectBigQuery(
  projectId: string,
  input: ConnectBigQueryInput
): Promise<Project> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const db = getDbPool();
  const { rows } = await db.query<Project>(
    `update projects
     set gcp_project_id = $1, ga4_dataset = $2, bigquery_dataset = $3
     where id = $4
     returning *`,
    [input.gcpProjectId, input.ga4Dataset, input.bigqueryDataset ?? "attribution", projectId]
  );
  return rows[0];
}

export async function renameProject(projectId: string, name: string): Promise<Project> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const db = getDbPool();
  const { rows } = await db.query<Project>(
    `update projects set name = $1 where id = $2 returning *`,
    [name, projectId]
  );
  return rows[0];
}

export async function deleteProject(projectId: string): Promise<void> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const db = getDbPool();
  await db.query(`delete from projects where id = $1`, [projectId]);
}

/** Déchiffre le refresh token OAuth d'un projet. Utilisé côté serveur uniquement. */
export async function getProjectOAuthToken(projectId: string): Promise<string | null> {
  const db = getDbPool();
  const { rows } = await db.query<{ oauth_refresh_token_encrypted: string | null }>(
    `select oauth_refresh_token_encrypted from projects where id = $1`,
    [projectId]
  );
  const encrypted = rows[0]?.oauth_refresh_token_encrypted;
  return encrypted ? decryptSecret(encrypted) : null;
}

/** Collaborateurs ajoutés directement au projet (par email). Visible par quiconque a accès au projet. */
export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found or not accessible");

  const db = getDbPool();
  const { rows } = await db.query<ProjectMember>(
    `select u.id as user_id, u.name, u.email, u.image, pm.created_at
     from project_members pm
     join users u on u.id = pm.user_id
     where pm.project_id = $1
     order by pm.created_at asc`,
    [projectId]
  );
  return rows;
}

export class ProjectMemberUserNotFoundError extends Error {
  constructor() {
    super("No user with this email");
    this.name = "ProjectMemberUserNotFoundError";
  }
}

/** Ajoute un collaborateur par email : doit déjà avoir un compte AttribMaster. Réservé owner/admin du projet. */
export async function addProjectMember(projectId: string, email: string): Promise<ProjectMember> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const db = getDbPool();
  const { rows: userRows } = await db.query<{
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  }>(`select id, name, email, image from users where lower(email) = lower($1)`, [email]);
  const user = userRows[0];
  if (!user) throw new ProjectMemberUserNotFoundError();

  await db.query(
    `insert into project_members (project_id, user_id, added_by)
     values ($1, $2, $3)
     on conflict (project_id, user_id) do nothing`,
    [projectId, user.id, userId]
  );

  const { rows } = await db.query<{ created_at: string }>(
    `select created_at from project_members where project_id = $1 and user_id = $2`,
    [projectId, user.id]
  );

  return {
    user_id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    created_at: rows[0].created_at,
  };
}

/** Retire un collaborateur ajouté directement. Réservé owner/admin du projet. */
export async function removeProjectMember(projectId: string, memberUserId: string): Promise<void> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const db = getDbPool();
  await db.query(`delete from project_members where project_id = $1 and user_id = $2`, [
    projectId,
    memberUserId,
  ]);
}
