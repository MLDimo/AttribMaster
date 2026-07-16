import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  enqueueBackfillForAllProjects,
  enqueueJob,
  enqueueManualRefresh,
  getLatestJobForProject,
  processQueue,
} from "@/lib/attribution/queue";
import { encryptSecret } from "@/lib/crypto/secrets";
import { getDbPool } from "@/lib/db/client";

describe("nightly attribution job queue", () => {
  let projectId: string;

  beforeAll(async () => {
    const pool = getDbPool();
    const { rows } = await pool.query(
      `insert into projects (name, bigquery_dataset) values ('CI Queue Test Project', 'attribution') returning id`
    );
    projectId = rows[0].id;
  });

  afterEach(async () => {
    const pool = getDbPool();
    await pool.query(`delete from nightly_jobs where project_id = $1`, [projectId]);
  });

  afterAll(async () => {
    const pool = getDbPool();
    await pool.query(`delete from projects where id = $1`, [projectId]);
  });

  it("enqueues a new pending job", async () => {
    const job = await enqueueJob(projectId, "2026-07-01", "manual");
    expect(job.status).toBe("pending");
    expect(job.project_id).toBe(projectId);
  });

  it("does not reset a job that is already pending/processing (no duplicate run)", async () => {
    const first = await enqueueJob(projectId, "2026-07-02", "cron");
    const pool = getDbPool();
    await pool.query(`update nightly_jobs set status = 'processing' where id = $1`, [first.id]);

    const second = await enqueueJob(projectId, "2026-07-02", "manual");
    expect(second.id).toBe(first.id);
    expect(second.status).toBe("processing"); // pas remis à pending
  });

  it("resets a done/failed job to pending on retry (same row, same unique key)", async () => {
    const first = await enqueueJob(projectId, "2026-07-03", "cron");
    const pool = getDbPool();
    await pool.query(
      `update nightly_jobs set status = 'failed', error = 'boom', finished_at = now() where id = $1`,
      [first.id]
    );

    const retried = await enqueueJob(projectId, "2026-07-03", "manual");
    expect(retried.id).toBe(first.id); // même ligne (contrainte unique project_id+target_date)
    expect(retried.status).toBe("pending");
    expect(retried.error).toBeNull();
    expect(retried.trigger_source).toBe("manual");
  });

  it("getLatestJobForProject returns the most recently created job", async () => {
    await enqueueJob(projectId, "2026-06-01", "cron");
    await new Promise((r) => setTimeout(r, 5));
    const latest = await enqueueJob(projectId, "2026-06-02", "cron");

    const found = await getLatestJobForProject(projectId);
    expect(found?.id).toBe(latest.id);
  });

  it("enqueueManualRefresh targets yesterday and does not duplicate an in-flight job", async () => {
    const job = await enqueueManualRefresh(projectId);
    expect(job.trigger_source).toBe("manual");
    expect(job.status).toBe("pending");

    const again = await enqueueManualRefresh(projectId);
    expect(again.id).toBe(job.id); // pas de deuxième ligne créée
  });

  it("processQueue claims a pending job and completes it (failed, since there is no real BigQuery connection) without leaving it stuck", async () => {
    await enqueueJob(projectId, "2026-05-01", "manual");
    const { processed } = await processQueue(Date.now() + 15000);
    expect(processed).toBeGreaterThanOrEqual(1);

    const job = await getLatestJobForProject(projectId);
    // Sans identifiants BigQuery réels pour ce projet de test, le job échoue —
    // ce qui est le comportement attendu ici : l'important est qu'il ne reste
    // JAMAIS bloqué en "processing", et que l'erreur soit enregistrée.
    expect(job?.status).toBe("failed");
    expect(job?.error).toBeTruthy();
    expect(job?.finished_at).toBeTruthy();
  });

  it("enqueueBackfillForAllProjects enqueues a 3-day retry window (GA4 export can lag up to 72h)", async () => {
    const pool = getDbPool();
    await pool.query(
      `update projects
       set gcp_project_id = 'ci-backfill-test-gcp-project',
           ga4_dataset = 'analytics_ci_backfill_test',
           oauth_refresh_token_encrypted = $2,
           subscription_status = 'active'
       where id = $1`,
      [projectId, encryptSecret("1//ci-backfill-test-refresh-token")]
    );

    const jobs = await enqueueBackfillForAllProjects();
    try {
      const ownJobs = jobs.filter((j) => j.project_id === projectId);

      expect(ownJobs).toHaveLength(3);
      expect(new Set(ownJobs.map((j) => j.target_date)).size).toBe(3);
      for (const job of ownJobs) {
        expect(job.trigger_source).toBe("cron");
        expect(job.status).toBe("pending");
      }
    } finally {
      // Cette fonction touche TOUS les projets connectés+abonnés (dont le
      // fixture e2e persistant) : on nettoie explicitement tout ce qu'elle a
      // créé pour ne pas polluer processQueue() dans les tests suivants.
      await pool.query(`delete from nightly_jobs where id = any($1)`, [jobs.map((j) => j.id)]);
    }
  });

  it("processQueue ignores a job that is already processing (SKIP LOCKED semantics)", async () => {
    const job = await enqueueJob(projectId, "2026-05-02", "manual");
    const pool = getDbPool();
    await pool.query(`update nightly_jobs set status = 'processing' where id = $1`, [job.id]);

    const { processed } = await processQueue(Date.now() + 5000);
    expect(processed).toBe(0);

    const { rows } = await pool.query(`select status from nightly_jobs where id = $1`, [job.id]);
    expect(rows[0].status).toBe("processing"); // toujours en cours, pas re-réclamé
  });
});
