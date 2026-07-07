import { auth } from "@/auth";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { getDbPool } from "@/lib/db/client";
import type { Account, Project } from "./types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

async function isOwnerOrAdmin(workspaceId: string, userId: string): Promise<boolean> {
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

export async function listAccessibleProjects(): Promise<Project[]> {
  const userId = await requireUserId();
  const db = getDbPool();
  const { rows } = await db.query<Project>(
    `select distinct p.* from projects p
     join workspace_projects wp on wp.project_id = p.id
     join workspace_members wm on wm.workspace_id = wp.workspace_id
     where wm.user_id = $1
     order by p.name`,
    [userId]
  );
  return rows;
}

/** Retourne le projet seulement si l'utilisateur courant y a accès (via un de ses workspaces). */
export async function getProject(projectId: string): Promise<Project | null> {
  const userId = await requireUserId();
  const db = getDbPool();
  const { rows } = await db.query<Project>(
    `select distinct p.* from projects p
     join workspace_projects wp on wp.project_id = p.id
     join workspace_members wm on wm.workspace_id = wp.workspace_id
     where wm.user_id = $1 and p.id = $2`,
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
    throw new Error("Not authorized on this account");
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

async function requireProjectAccess(projectId: string, userId: string): Promise<void> {
  const db = getDbPool();
  const { rows } = await db.query(
    `select 1 from workspace_projects wp
     join workspace_members wm on wm.workspace_id = wp.workspace_id
     where wp.project_id = $1 and wm.user_id = $2 and wm.role in ('owner', 'admin')`,
    [projectId, userId]
  );
  if (rows.length === 0) throw new Error("Not authorized on this project");
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
