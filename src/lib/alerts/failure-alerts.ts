import { MOCK_PROJECT_ID } from "@/lib/attribution/mock-data";
import { classifyNightlyFailure, type NightlyFailureKind } from "@/lib/attribution/queue";
import { hasEmailSending, sendEmail } from "@/lib/email/resend";
import { getDbPool } from "@/lib/db/client";

/**
 * Alerte email quand la mise à jour nocturne d'un projet échoue (token Google
 * révoqué, dataset supprimé...) : sans ça, le client regarde des chiffres
 * périmés sans le savoir. Envoi via l'API REST Resend (pas de SDK), activé
 * uniquement si RESEND_API_KEY est présent — no-op propre sinon.
 */

const ALERT_THROTTLE_DAYS = 3;

export type FailureAlertCandidate = {
  project_id: string;
  project_name: string;
  gcp_project_id: string | null;
  error: string | null;
  last_success_at: string | null;
  last_failure_alert_at: string | null;
  billing_alert_sent_at: string | null;
  owner_emails: string[];
};

/**
 * Décide s'il faut écrire au client, et avec quel message.
 *
 * Les deux cadences vivent ICI plutôt qu'en SQL, et surtout elles sont
 * INDÉPENDANTES : sinon le throttle glissant des pannes génériques retenait
 * jusqu'à 3 jours le premier email de facturation (constaté sur un vrai
 * projet, déjà alerté 2 jours plus tôt pour une autre panne) — or c'est
 * précisément l'email qui demande d'agir vite.
 *
 * - facturation : UN SEUL email par panne. Le geste correctif est unique et
 *   hors de notre portée (rattacher un compte de facturation dans SA console
 *   Google Cloud) ; relancer n'apprendrait rien. `billing_alert_sent_at` est
 *   remis à NULL au premier run réussi (voir `completeJob`), donc une panne
 *   ultérieure redonne bien lieu à un email.
 * - reste : relance tous les 3 jours tant que ça échoue, la cause pouvant
 *   changer ou se résoudre d'elle-même.
 */
export function planFailureAlert(
  candidate: FailureAlertCandidate,
  now: Date = new Date()
): { kind: NightlyFailureKind; send: boolean } {
  const kind = classifyNightlyFailure(candidate.error);
  if (kind === "billing") return { kind, send: candidate.billing_alert_sent_at === null };
  if (!candidate.last_failure_alert_at) return { kind, send: true };
  const elapsedDays =
    (now.getTime() - new Date(candidate.last_failure_alert_at).getTime()) / (24 * 60 * 60 * 1000);
  return { kind, send: elapsedDays >= ALERT_THROTTLE_DAYS };
}

/**
 * Projets dont le DERNIER job est en échec, avec les emails des owners des
 * workspaces rattachés. Ne filtre PAS sur la cadence d'envoi : c'est
 * `planFailureAlert` qui tranche, faute de quoi le throttle générique
 * masquerait aussi le premier email de facturation.
 */
export async function findProjectsNeedingFailureAlert(): Promise<FailureAlertCandidate[]> {
  const db = getDbPool();
  const { rows } = await db.query<FailureAlertCandidate>(
    `with latest_jobs as (
       select distinct on (project_id) project_id, status, error
       from nightly_jobs
       order by project_id, created_at desc
     )
     select
       p.id as project_id,
       p.name as project_name,
       p.gcp_project_id,
       p.last_failure_alert_at::text as last_failure_alert_at,
       p.billing_alert_sent_at::text as billing_alert_sent_at,
       lj.error,
       (select max(finished_at)::text from nightly_jobs nj
        where nj.project_id = p.id and nj.status = 'done') as last_success_at,
       coalesce(
         (select array_agg(distinct u.email)
          from workspace_projects wp
          join workspace_members wm on wm.workspace_id = wp.workspace_id and wm.role = 'owner'
          join users u on u.id = wm.user_id
          where wp.project_id = p.id and u.email is not null),
         '{}'
       ) as owner_emails
     from projects p
     join latest_jobs lj on lj.project_id = p.id and lj.status = 'failed'
     where p.id != $1`,
    [MOCK_PROJECT_ID]
  );
  return rows;
}

async function markAlerted(projectId: string, kind: NightlyFailureKind): Promise<void> {
  const db = getDbPool();
  await db.query(
    kind === "billing"
      ? `update projects set last_failure_alert_at = now(), billing_alert_sent_at = now() where id = $1`
      : `update projects set last_failure_alert_at = now() where id = $1`,
    [projectId]
  );
}

function buildAlertHtml(candidate: FailureAlertCandidate): string {
  const staleness = candidate.last_success_at
    ? `Les chiffres de ton dashboard datent du ${new Date(candidate.last_success_at).toLocaleDateString("fr-FR")}.`
    : "Aucune donnée n'a encore pu être importée pour ce projet.";
  return `
    <p>Bonjour,</p>
    <p>La mise à jour automatique des données du projet <strong>${candidate.project_name}</strong> a échoué cette nuit.</p>
    <p>${staleness}</p>
    <p>Le plus souvent, il suffit de reconnecter BigQuery (l'accès Google a pu être révoqué) :</p>
    <p><a href="https://attribmaster.com/projects/${candidate.project_id}/manage">Gérer le projet</a></p>
    <p style="color:#8a7967;font-size:13px">Erreur technique : ${candidate.error ?? "inconnue"}</p>
  `;
}

/**
 * Email dédié à la panne de facturation. Il dit trois choses que le message
 * générique ne dit pas, et sans lesquelles le client cherche au mauvais
 * endroit : que sa connexion BigQuery n'est PAS en cause, que réactiver la
 * facturation ne le fera pas payer (le palier gratuit continue de
 * s'appliquer — c'est la crainte qui bloque le plus souvent), et sur quel
 * projet Google Cloud précisément agir.
 */
function buildBillingAlertHtml(candidate: FailureAlertCandidate): string {
  const staleness = candidate.last_success_at
    ? `Les chiffres de ton dashboard datent du ${new Date(candidate.last_success_at).toLocaleDateString("fr-FR")} et n'évolueront plus tant que ce n'est pas réglé.`
    : "Aucune donnée n'a encore pu être importée pour ce projet.";
  const billingUrl = candidate.gcp_project_id
    ? `https://console.cloud.google.com/billing/linkedaccount?project=${encodeURIComponent(candidate.gcp_project_id)}`
    : "https://console.cloud.google.com/billing";
  return `
    <p>Bonjour,</p>
    <p>La mise à jour automatique du projet <strong>${candidate.project_name}</strong> est bloquée : le projet
       Google Cloud <strong>${candidate.gcp_project_id ?? "associé"}</strong> n'a plus de compte de facturation actif.</p>
    <p>Sans facturation, BigQuery repasse en mode « bac à sable » : la lecture fonctionne toujours, mais toute
       écriture est refusée — AttribMaster ne peut donc plus enregistrer tes résultats d'attribution.
       <strong>Ta connexion BigQuery, elle, n'est pas en cause.</strong></p>
    <p>${staleness}</p>
    <p><strong>Réactiver la facturation ne te fera pas payer :</strong> le palier gratuit de BigQuery
       (1 To de requêtes par mois) continue de s'appliquer. La carte sert uniquement à sortir du mode bac à sable.</p>
    <p><a href="${billingUrl}">Réactiver la facturation du projet</a></p>
    <p style="color:#8a7967;font-size:13px">Tu ne recevras pas de relance pour cette panne : dès qu'une mise à jour
       repasse, tout redémarre automatiquement.</p>
  `;
}

export type FailureAlertsResult = {
  skipped: boolean;
  alerted: number;
};

/** À appeler après le drain du cron nocturne. Ne lève jamais (best effort). */
export async function sendFailureAlerts(): Promise<FailureAlertsResult> {
  if (!hasEmailSending()) {
    return { skipped: true, alerted: 0 };
  }

  let alerted = 0;
  try {
    const candidates = await findProjectsNeedingFailureAlert();
    for (const candidate of candidates) {
      if (candidate.owner_emails.length === 0) continue;
      const { kind, send } = planFailureAlert(candidate);
      if (!send) continue;
      try {
        await sendEmail(
          candidate.owner_emails,
          kind === "billing"
            ? `⚠️ Facturation Google Cloud à réactiver — ${candidate.project_name}`
            : `⚠️ Mise à jour en échec — ${candidate.project_name}`,
          kind === "billing" ? buildBillingAlertHtml(candidate) : buildAlertHtml(candidate)
        );
        await markAlerted(candidate.project_id, kind);
        alerted += 1;
      } catch (error) {
        console.error("[alerts] failed to send for project", candidate.project_id, error);
      }
    }
  } catch (error) {
    console.error("[alerts] sendFailureAlerts failed", error);
  }
  return { skipped: false, alerted };
}
