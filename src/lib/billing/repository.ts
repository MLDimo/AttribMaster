import { getDbPool } from "@/lib/db/client";
import {
  getProjectAsService,
  getProjectPrimaryWorkspaceId,
  isOwnerOrAdmin,
  requireProjectAccess,
  requireUserId,
} from "@/lib/projects/repository";
import { getStripeClient } from "@/lib/stripe/client";
import type { BillingAccount, BillingInterval, PlanId, Project } from "@/lib/projects/types";

/** Comptes de facturation (clients Stripe) des workspaces où l'utilisateur est owner/admin. */
export async function listMyBillingAccounts(): Promise<BillingAccount[]> {
  const userId = await requireUserId();
  const db = getDbPool();
  const { rows } = await db.query<BillingAccount>(
    `select distinct ba.* from billing_accounts ba
     join workspace_members wm on wm.workspace_id = ba.workspace_id
     where wm.user_id = $1 and wm.role in ('owner', 'admin')
     order by ba.name`,
    [userId]
  );
  return rows;
}

async function requireBillingAccountAccess(billingAccountId: string, userId: string): Promise<BillingAccount> {
  const db = getDbPool();
  const { rows } = await db.query<BillingAccount>(
    `select ba.* from billing_accounts ba
     join workspace_members wm on wm.workspace_id = ba.workspace_id
     where ba.id = $1 and wm.user_id = $2 and wm.role in ('owner', 'admin')`,
    [billingAccountId, userId]
  );
  if (!rows[0]) throw new Error("Billing account not found or not accessible");
  return rows[0];
}

/** Crée un compte de facturation (+ client Stripe) pour un workspace. Réservé owner/admin. */
export async function createBillingAccount(workspaceId: string, name: string): Promise<BillingAccount> {
  const userId = await requireUserId();
  if (!(await isOwnerOrAdmin(workspaceId, userId))) {
    throw new Error("Not authorized on this workspace");
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({ name });

  const db = getDbPool();
  const { rows } = await db.query<BillingAccount>(
    `insert into billing_accounts (workspace_id, name, stripe_customer_id, created_by)
     values ($1, $2, $3, $4)
     returning *`,
    [workspaceId, name, customer.id, userId]
  );
  return rows[0];
}

export type SubscribeInput = {
  plan: Exclude<PlanId, "custom">;
  interval: BillingInterval;
  billingAccountId?: string;
  newBillingAccountName?: string;
};

/**
 * Vérifie l'accès au projet, résout le compte de facturation (existant ou à
 * créer à la volée), avant de créer un Checkout Session.
 */
export async function prepareSubscription(
  projectId: string,
  input: SubscribeInput
): Promise<{ project: Project; billingAccount: BillingAccount }> {
  const userId = await requireUserId();
  await requireProjectAccess(projectId, userId);

  const project = await getProjectAsService(projectId);
  if (!project) throw new Error("Project not found");

  if (input.billingAccountId) {
    const billingAccount = await requireBillingAccountAccess(input.billingAccountId, userId);
    return { project, billingAccount };
  }

  if (input.newBillingAccountName) {
    const workspaceId = await getProjectPrimaryWorkspaceId(projectId);
    if (!workspaceId) throw new Error("Project has no workspace");
    const billingAccount = await createBillingAccount(workspaceId, input.newBillingAccountName);
    return { project, billingAccount };
  }

  throw new Error("billingAccountId or newBillingAccountName is required");
}

export type SubscriptionSync = {
  projectId: string;
  billingAccountId: string;
  plan: PlanId;
  interval: BillingInterval;
  stripeSubscriptionId: string;
  status: string;
};

/** Synchronise l'état d'abonnement d'un projet suite à un événement Stripe (checkout / webhook). */
export async function syncProjectSubscription(input: SubscriptionSync): Promise<void> {
  const db = getDbPool();
  await db.query(
    `update projects
     set billing_account_id = $1, plan = $2, billing_interval = $3,
         stripe_subscription_id = $4, subscription_status = $5
     where id = $6`,
    [
      input.billingAccountId,
      input.plan,
      input.interval,
      input.stripeSubscriptionId,
      input.status,
      input.projectId,
    ]
  );
}

/** Met à jour uniquement le statut, à partir d'un événement webhook portant l'ID de souscription Stripe. */
export async function updateSubscriptionStatusByStripeId(
  stripeSubscriptionId: string,
  status: string
): Promise<void> {
  const db = getDbPool();
  await db.query(`update projects set subscription_status = $1 where stripe_subscription_id = $2`, [
    status,
    stripeSubscriptionId,
  ]);
}

export type CustomPlanRequestInput = {
  projectId: string | null;
  name: string;
  email: string;
  company?: string;
  message?: string;
};

export async function createCustomPlanRequest(input: CustomPlanRequestInput): Promise<void> {
  const userId = await requireUserId().catch(() => null);
  const db = getDbPool();
  await db.query(
    `insert into custom_plan_requests (project_id, user_id, name, email, company, message)
     values ($1, $2, $3, $4, $5, $6)`,
    [input.projectId, userId, input.name, input.email, input.company ?? null, input.message ?? null]
  );
}
