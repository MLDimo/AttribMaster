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
  error: string | null;
  last_success_at: string | null;
  owner_emails: string[];
};

/**
 * Projets dont le DERNIER job est en échec, pas déjà alertés depuis moins de
 * 3 jours, avec les emails des owners des workspaces rattachés.
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
     where p.last_failure_alert_at is null
        or p.last_failure_alert_at < now() - interval '${ALERT_THROTTLE_DAYS} days'`
  );
  return rows;
}

async function markAlerted(projectId: string): Promise<void> {
  const db = getDbPool();
  await db.query(`update projects set last_failure_alert_at = now() where id = $1`, [projectId]);
}

async function sendEmail(apiKey: string, to: string[], subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ALERT_FROM_EMAIL ?? "AttribMaster <alerts@attribmaster.com>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend API error ${res.status}: ${await res.text()}`);
  }
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

export type FailureAlertsResult = {
  skipped: boolean;
  alerted: number;
};

/** À appeler après le drain du cron nocturne. Ne lève jamais (best effort). */
export async function sendFailureAlerts(): Promise<FailureAlertsResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, alerted: 0 };
  }

  let alerted = 0;
  try {
    const candidates = await findProjectsNeedingFailureAlert();
    for (const candidate of candidates) {
      if (candidate.owner_emails.length === 0) continue;
      try {
        await sendEmail(
          apiKey,
          candidate.owner_emails,
          `⚠️ Mise à jour en échec — ${candidate.project_name}`,
          buildAlertHtml(candidate)
        );
        await markAlerted(candidate.project_id);
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
