import { getDbPool } from "@/lib/db/client";
import { listAllProjectsAsService } from "@/lib/projects/repository";
import { isProjectConnected, isProjectSubscribed } from "@/lib/projects/types";
import { runNightlyAttributionForProject, toDateOnly } from "@/lib/attribution/nightly-run";

export type JobStatus = "pending" | "processing" | "done" | "failed";

export type NightlyJob = {
  id: string;
  project_id: string;
  target_date: string;
  status: JobStatus;
  trigger_source: "cron" | "manual";
  rows_inserted: number | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

function yesterday(): string {
  return toDateOnly(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

/**
 * Ajoute un job en file (idempotent) : si un job pour ce projet+jour est déjà
 * pending/processing, ne le touche pas (pas de double run concurrent) ; s'il
 * est déjà done/failed, le remet en pending pour permettre un nouveau run
 * (retry manuel notamment).
 */
export async function enqueueJob(
  projectId: string,
  targetDate: string,
  triggerSource: "cron" | "manual"
): Promise<NightlyJob> {
  const db = getDbPool();
  await db.query(
    `insert into nightly_jobs (project_id, target_date, status, trigger_source)
     values ($1, $2, 'pending', $3)
     on conflict (project_id, target_date)
     do update set status = 'pending', trigger_source = excluded.trigger_source,
       error = null, rows_inserted = null, started_at = null, finished_at = null
     where nightly_jobs.status in ('done', 'failed')`,
    [projectId, targetDate, triggerSource]
  );
  const { rows } = await db.query<NightlyJob>(
    `select * from nightly_jobs where project_id = $1 and target_date = $2`,
    [projectId, targetDate]
  );
  return rows[0];
}

/** Un job "hier" par projet connecté + abonné, appelé chaque jour par le cron. */
export async function enqueueYesterdayForAllProjects(): Promise<NightlyJob[]> {
  const targetDate = yesterday();
  const projects = (await listAllProjectsAsService()).filter(
    (p) => isProjectConnected(p) && isProjectSubscribed(p)
  );
  return Promise.all(projects.map((p) => enqueueJob(p.id, targetDate, "cron")));
}

/** Enfile un run "hier" à la demande pour un seul projet (bouton Actualiser). */
export async function enqueueManualRefresh(projectId: string): Promise<NightlyJob> {
  return enqueueJob(projectId, yesterday(), "manual");
}

/**
 * Réclame atomiquement le job pending le plus ancien (SELECT ... FOR UPDATE
 * SKIP LOCKED dans la même requête que l'UPDATE) : sûr à invoquer plusieurs
 * fois en parallèle, chaque appel récupère un job différent.
 */
async function claimNextJob(): Promise<NightlyJob | null> {
  const db = getDbPool();
  const { rows } = await db.query<NightlyJob>(
    `update nightly_jobs
     set status = 'processing', started_at = now()
     where id = (
       select id from nightly_jobs
       where status = 'pending'
       order by created_at
       for update skip locked
       limit 1
     )
     returning *`
  );
  return rows[0] ?? null;
}

async function completeJob(
  jobId: string,
  result: { status: "done"; rowsInserted: number } | { status: "failed"; error: string }
): Promise<void> {
  const db = getDbPool();
  await db.query(
    `update nightly_jobs
     set status = $2, rows_inserted = $3, error = $4, finished_at = now()
     where id = $1`,
    [
      jobId,
      result.status,
      result.status === "done" ? result.rowsInserted : null,
      result.status === "failed" ? result.error : null,
    ]
  );
}

/**
 * Vide la file un job à la fois jusqu'à épuisement ou jusqu'à `deadline`
 * (timestamp ms) : appelée juste après l'enqueue (cron quotidien ou refresh
 * manuel) pour traiter tout de suite sans attendre un prochain tick, sans
 * jamais dépasser le budget de temps de la fonction serverless.
 */
export async function processQueue(deadline: number): Promise<{ processed: number }> {
  let processed = 0;
  while (Date.now() < deadline) {
    const job = await claimNextJob();
    if (!job) break;
    try {
      // Le driver Postgres renvoie une colonne `date` comme un objet Date (pas
      // une string malgré le typage) : sans cette normalisation, BigQuery
      // reçoit un Date là où `client.date()` attend "YYYY-MM-DD" et échoue.
      const targetDate = toDateOnly(new Date(job.target_date));
      const result = await runNightlyAttributionForProject(job.project_id, targetDate);
      await completeJob(job.id, { status: "done", rowsInserted: result.rowsInserted });
    } catch (error) {
      await completeJob(job.id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
    processed += 1;
  }
  return { processed };
}

export async function getLatestJobForProject(projectId: string): Promise<NightlyJob | null> {
  const db = getDbPool();
  const { rows } = await db.query<NightlyJob>(
    `select * from nightly_jobs where project_id = $1 order by created_at desc limit 1`,
    [projectId]
  );
  return rows[0] ?? null;
}
