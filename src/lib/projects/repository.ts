import { auth } from "@/auth";
import { MOCK_PROJECT, MOCK_PROJECT_ID } from "@/lib/attribution/mock-data";
import type { CustomModelConfig } from "@/lib/attribution/types";
import { NotAuthorizedError, UnauthenticatedError } from "@/lib/auth/errors";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { getDbPool } from "@/lib/db/client";
import { escapeHtml, hasEmailSending, sendEmail } from "@/lib/email/resend";
import { renderEmailButton, renderEmailLayout } from "@/lib/email/template";
import { cancelStripeSubscription } from "@/lib/stripe/cancel-subscription";
import type { Account, Project, ProjectMember, ProjectMemberInvite, ProjectMemberRole } from "./types";

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
  // Mode démo : accessible à tout utilisateur connecté (pas d'accès via
  // workspace nécessaire), en lecture seule — voir MOCK_PROJECT.
  if (projectId === MOCK_PROJECT_ID) return MOCK_PROJECT;
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

/**
 * Owner/admin du workspace propriétaire du projet, OU collaborateur promu
 * "owner" directement sur ce projet (project_members.role = 'owner') — le
 * seul niveau habilité à modifier quoi que ce soit. Un collaborateur "owner"
 * de projet a les mêmes droits qu'un owner/admin de workspace mais SEULEMENT
 * sur ce projet (jamais sur les autres projets du workspace, sa facturation,
 * ou ses membres).
 */
export async function hasProjectManageAccess(projectId: string, userId: string): Promise<boolean> {
  const db = getDbPool();
  const { rows } = await db.query(
    `select 1 from workspace_projects wp
     join workspace_members wm on wm.workspace_id = wp.workspace_id
     where wp.project_id = $1 and wm.user_id = $2 and wm.role in ('owner', 'admin')
     union
     select 1 from project_members pm
     where pm.project_id = $1 and pm.user_id = $2 and pm.role = 'owner'`,
    [projectId, userId]
  );
  return rows.length > 0;
}

/**
 * Un collaborateur ajouté directement (project_members) démarre en rôle
 * "read" (lecture seule) : jamais admin/owner du workspace, donc
 * `hasProjectManageAccess` est faux pour lui tant qu'il n'a pas été promu
 * "owner" — voir `updateProjectMemberRole`.
 */
export type ProjectWithAccess = { project: Project; canManage: boolean };

/** Combine lecture + niveau d'accès de l'utilisateur courant, pour l'affichage (masquer les actions de gestion). */
export async function getProjectWithAccess(projectId: string): Promise<ProjectWithAccess | null> {
  const userId = await requireUserId();
  if (projectId === MOCK_PROJECT_ID) return { project: MOCK_PROJECT, canManage: false };
  const db = getDbPool();
  const { rows } = await db.query<Project>(
    `select distinct p.* from projects p
     where p.id = $2 and (${ACCESSIBLE_PROJECTS_WHERE})`,
    [userId, projectId]
  );
  const project = rows[0];
  if (!project) return null;
  return { project, canManage: await hasProjectManageAccess(projectId, userId) };
}

export async function requireProjectAccess(projectId: string, userId: string): Promise<void> {
  if (!(await hasProjectManageAccess(projectId, userId))) throw new NotAuthorizedError("project");
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

/**
 * Enregistre le modèle d'attribution personnalisé du projet (une config à la
 * fois, pas d'historique de presets). Le contrôle "somme = 100" est déjà fait
 * par zod à la frontière API et par la contrainte DB (`custom_model_pct_sum_100`) ;
 * pas de revalidation ici, elle serait redondante avec ces deux couches.
 */
export async function saveCustomModelConfig(projectId: string, config: CustomModelConfig): Promise<Project> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const db = getDbPool();
  const { rows } = await db.query<Project>(
    `update projects
     set custom_model_first_touch_pct = $1, custom_model_middle_pct = $2, custom_model_last_touch_pct = $3,
         custom_model_rules = $4::jsonb
     where id = $5
     returning *`,
    [config.firstTouchPercent, config.middlePercent, config.lastTouchPercent, JSON.stringify(config.rules), projectId]
  );
  return rows[0];
}

/** Repasse le projet en "pas de modèle personnalisé configuré" (les 3 colonnes à NULL, règles vidées). */
export async function clearCustomModelConfig(projectId: string): Promise<Project> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const db = getDbPool();
  const { rows } = await db.query<Project>(
    `update projects
     set custom_model_first_touch_pct = null, custom_model_middle_pct = null, custom_model_last_touch_pct = null,
         custom_model_rules = '[]'::jsonb
     where id = $1
     returning *`,
    [projectId]
  );
  return rows[0];
}

/** Enregistre l'URL Google Sheets cible ; efface tout état d'erreur précédent (une nouvelle URL mérite un essai propre). */
export async function saveGoogleSheetExportUrl(projectId: string, url: string): Promise<Project> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const db = getDbPool();
  const { rows } = await db.query<Project>(
    `update projects
     set export_google_sheet_url = $1, export_google_sheet_last_error = null, export_google_sheet_last_synced_at = null
     where id = $2
     returning *`,
    [url, projectId]
  );
  return rows[0];
}

/** Désactive l'export (l'URL et tout état associé). */
export async function clearGoogleSheetExportUrl(projectId: string): Promise<Project> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const db = getDbPool();
  const { rows } = await db.query<Project>(
    `update projects
     set export_google_sheet_url = null, export_google_sheet_last_error = null, export_google_sheet_last_synced_at = null
     where id = $1
     returning *`,
    [projectId]
  );
  return rows[0];
}

/**
 * Enregistre le résultat d'une tentative d'export nocturne — sans vérification
 * d'accès, réservé au contexte serveur-à-serveur (script de nuit), comme
 * `getProjectOAuthToken`. Un succès efface l'erreur précédente ; un échec la
 * pose sans toucher `last_synced_at` (garde la date de la dernière réussite).
 */
export async function recordGoogleSheetExportResult(projectId: string, error: string | null): Promise<void> {
  const db = getDbPool();
  if (error === null) {
    await db.query(
      `update projects set export_google_sheet_last_synced_at = now(), export_google_sheet_last_error = null where id = $1`,
      [projectId]
    );
  } else {
    await db.query(`update projects set export_google_sheet_last_error = $1 where id = $2`, [error, projectId]);
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const db = getDbPool();
  // Annule l'abonnement AVANT de supprimer : sinon Stripe continue de
  // facturer un projet disparu, sans plus aucun portail de facturation
  // accessible côté client pour l'arrêter. Si Stripe est injoignable, on
  // préfère faire échouer la suppression (l'utilisateur réessaiera) plutôt
  // que de laisser une facturation orpheline.
  const { rows } = await db.query<{ stripe_subscription_id: string | null }>(
    `select stripe_subscription_id from projects where id = $1`,
    [projectId]
  );
  const subscriptionId = rows[0]?.stripe_subscription_id;
  if (subscriptionId) {
    await cancelStripeSubscription(subscriptionId);
  }

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
    `select u.id as user_id, u.name, u.email, u.image, pm.role, pm.created_at
     from project_members pm
     join users u on u.id = pm.user_id
     where pm.project_id = $1
     order by pm.created_at asc`,
    [projectId]
  );
  return rows;
}

export type AddProjectMemberResult =
  | { kind: "member"; member: ProjectMember }
  | { kind: "invited"; invite: ProjectMemberInvite };

/**
 * Ajoute un collaborateur par email. S'il a déjà un compte AttribMaster,
 * accès immédiat (project_members, rôle "read" par défaut). Sinon, une
 * invitation est mémorisée (`project_member_invites`) et un email est
 * envoyé : elle se transforme en accès réel automatiquement dès qu'un
 * compte est créé avec cet email (trigger `handle_new_user`, quel que soit
 * le moyen d'inscription — email/mot de passe ou Google). Réservé
 * owner/admin du projet.
 */
export async function addProjectMember(
  projectId: string,
  email: string,
  origin: string
): Promise<AddProjectMemberResult> {
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

  if (user) {
    await db.query(
      `insert into project_members (project_id, user_id, added_by)
       values ($1, $2, $3)
       on conflict (project_id, user_id) do nothing`,
      [projectId, user.id, userId]
    );

    const { rows } = await db.query<{ role: ProjectMemberRole; created_at: string }>(
      `select role, created_at from project_members where project_id = $1 and user_id = $2`,
      [projectId, user.id]
    );

    return {
      kind: "member",
      member: {
        user_id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: rows[0].role,
        created_at: rows[0].created_at,
      },
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { rows: inviteRows } = await db.query<{ role: ProjectMemberRole; created_at: string }>(
    `insert into project_member_invites (project_id, email, invited_by)
     values ($1, $2, $3)
     on conflict (project_id, email) do update set invited_by = excluded.invited_by
     returning role, created_at`,
    [projectId, normalizedEmail, userId]
  );

  if (hasEmailSending()) {
    const [{ rows: projectRows }, { rows: inviterRows }] = await Promise.all([
      db.query<{ name: string }>(`select name from projects where id = $1`, [projectId]),
      db.query<{ name: string | null; email: string }>(`select name, email from users where id = $1`, [userId]),
    ]);
    const rawProjectName = projectRows[0]?.name ?? "un projet";
    const rawInviterLabel = inviterRows[0]?.name?.trim() || inviterRows[0]?.email || "Quelqu'un";
    const signupUrl = `${origin}/signup?email=${encodeURIComponent(normalizedEmail)}`;
    const projectName = escapeHtml(rawProjectName);
    const inviterLabel = escapeHtml(rawInviterLabel);
    await sendEmail(
      [normalizedEmail],
      // Sujet en texte brut (pas de HTML) : valeurs non échappées, comme les autres emails du projet (cf. failure-alerts.ts).
      `${rawInviterLabel} t'invite à rejoindre "${rawProjectName}" sur AttribMaster`,
      renderEmailLayout(
        `
          <p style="margin:0 0 16px 0;">Bonjour,</p>
          <p style="margin:0 0 16px 0;">
            <strong>${inviterLabel}</strong> t'invite à collaborer sur le projet <strong>${projectName}</strong> sur AttribMaster.
          </p>
          <p style="margin:0 0 24px 0;">
            Crée un compte avec cette adresse email (<strong>${escapeHtml(normalizedEmail)}</strong>), ou connecte-toi avec Google en utilisant la même adresse, pour accéder automatiquement, au dashboard d'attribution marketing du projet.
          </p>
          <p style="margin:0 0 24px 0;">${renderEmailButton("Accéder au projet", signupUrl)}</p>
          <p style="margin:0;color:#8a7967;font-size:13px;">Si tu ne connais pas cette personne, ignore cet email.</p>
        `,
        // Preheader : injecté dans le HTML (div cachée), donc les valeurs échappées — contrairement au sujet ci-dessus, qui est du texte brut.
        `${inviterLabel} t'invite à rejoindre "${projectName}" sur AttribMaster`
      )
    );
  }

  return { kind: "invited", invite: { email: normalizedEmail, role: inviteRows[0].role, created_at: inviteRows[0].created_at } };
}

/** Invitations en attente (pas encore de compte AttribMaster) pour ce projet. Visible par quiconque a accès au projet. */
export async function listPendingProjectMemberInvites(projectId: string): Promise<ProjectMemberInvite[]> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found or not accessible");

  const db = getDbPool();
  const { rows } = await db.query<ProjectMemberInvite>(
    `select email, role, created_at from project_member_invites where project_id = $1 order by created_at asc`,
    [projectId]
  );
  return rows;
}

/** Annule une invitation en attente. Réservé owner/admin du projet. */
export async function cancelProjectMemberInvite(projectId: string, email: string): Promise<void> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const db = getDbPool();
  await db.query(`delete from project_member_invites where project_id = $1 and lower(email) = lower($2)`, [
    projectId,
    email,
  ]);
}

export class ProjectMemberNotFoundError extends Error {
  constructor() {
    super("This user is not a direct collaborator on this project");
    this.name = "ProjectMemberNotFoundError";
  }
}

/**
 * Change le rôle d'un collaborateur ajouté directement (project_members).
 * Réservé owner/admin du projet (workspace owner/admin, ou déjà "owner" du
 * projet) — c'est ce qui permet à un admin de faire passer un collaborateur
 * de "lecture" à "owner" (accès de gestion complet sur ce projet).
 */
export async function updateProjectMemberRole(
  projectId: string,
  memberUserId: string,
  role: ProjectMemberRole
): Promise<ProjectMember> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const db = getDbPool();
  const { rows } = await db.query<ProjectMember>(
    `update project_members pm
     set role = $3
     from users u
     where pm.project_id = $1 and pm.user_id = $2 and u.id = pm.user_id
     returning pm.user_id, u.name, u.email, u.image, pm.role, pm.created_at`,
    [projectId, memberUserId, role]
  );
  if (!rows[0]) throw new ProjectMemberNotFoundError();
  return rows[0];
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
