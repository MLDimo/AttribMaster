import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findProjectsNeedingFailureAlert, planFailureAlert, sendFailureAlerts } from "@/lib/alerts/failure-alerts";
import { MOCK_PROJECT_ID } from "@/lib/attribution/mock-data";
import { completeJob, getProjectJobHealth } from "@/lib/attribution/queue";
import { getDbPool } from "@/lib/db/client";

describe("failure alerts", () => {
  let projectId: string;

  beforeAll(async () => {
    const pool = getDbPool();
    const { rows } = await pool.query(
      `insert into projects (name, bigquery_dataset) values ('CI Alerts Test Project', 'attribution') returning id`
    );
    projectId = rows[0].id;
  });

  afterAll(async () => {
    const pool = getDbPool();
    await pool.query(`delete from nightly_jobs where project_id = $1`, [projectId]);
    await pool.query(`delete from projects where id = $1`, [projectId]);
  });

  it("selects a project whose latest job failed, then throttles after alerting", async () => {
    const pool = getDbPool();
    await pool.query(
      `insert into nightly_jobs (project_id, target_date, status, error, finished_at)
       values ($1, '2026-06-01', 'failed', 'invalid_grant', now())`,
      [projectId]
    );

    const candidates = await findProjectsNeedingFailureAlert();
    const own = candidates.find((c) => c.project_id === projectId);
    expect(own).toBeDefined();
    expect(own?.error).toBe("invalid_grant");
    expect(planFailureAlert(own!)).toEqual({ kind: "generic", send: true });

    // Simule un envoi. La requête continue de remonter le projet (elle ne
    // filtre plus sur la cadence, pour ne pas masquer le premier email de
    // facturation) : c'est planFailureAlert qui doit désormais le taire.
    await pool.query(`update projects set last_failure_alert_at = now() where id = $1`, [projectId]);
    const after = await findProjectsNeedingFailureAlert();
    const throttled = after.find((c) => c.project_id === projectId);
    expect(throttled).toBeDefined();
    expect(planFailureAlert(throttled!).send).toBe(false);
  });

  it("never selects the demo project, even with a failed job and no throttle — its token is fake, it will fail forever otherwise", async () => {
    const pool = getDbPool();
    await pool.query(
      `insert into nightly_jobs (project_id, target_date, status, error, finished_at)
       values ($1, '2026-06-01', 'failed', 'invalid_grant', now())
       on conflict (project_id, target_date) do update set status = 'failed', error = excluded.error, finished_at = excluded.finished_at`,
      [MOCK_PROJECT_ID]
    );

    // Ne dépend PAS du throttle (last_failure_alert_at) : l'exclusion doit
    // tenir même quand rien n'a jamais été alerté, sinon le premier email
    // partirait quand même avant que le throttle ne prenne le relais.
    const candidates = await findProjectsNeedingFailureAlert();
    expect(candidates.find((c) => c.project_id === MOCK_PROJECT_ID)).toBeUndefined();

    await pool.query(`delete from nightly_jobs where project_id = $1 and target_date = '2026-06-01'`, [
      MOCK_PROJECT_ID,
    ]);
  });

  it("does not select a project whose latest job succeeded, even with older failures", async () => {
    const pool = getDbPool();
    await pool.query(`update projects set last_failure_alert_at = null where id = $1`, [projectId]);
    await pool.query(
      `insert into nightly_jobs (project_id, target_date, status, rows_inserted, finished_at)
       values ($1, '2026-06-02', 'done', 4, now())`,
      [projectId]
    );

    const candidates = await findProjectsNeedingFailureAlert();
    expect(candidates.find((c) => c.project_id === projectId)).toBeUndefined();
  });

  it("completeJob clears billing_alert_sent_at on success, so a later outage alerts again", async () => {
    const pool = getDbPool();
    const { rows: jobRows } = await pool.query(
      `insert into nightly_jobs (project_id, target_date, status, trigger_source)
       values ($1, '2026-06-03', 'pending', 'cron') returning id`,
      [projectId]
    );
    const jobId = jobRows[0].id;

    // Un échec ne clôt rien : la panne dure, le client a déjà son email.
    await pool.query(`update projects set billing_alert_sent_at = now() where id = $1`, [projectId]);
    await completeJob(jobId, { status: "failed", error: "Billing has not been enabled for this project." });
    const stillSet = await pool.query(`select billing_alert_sent_at from projects where id = $1`, [projectId]);
    expect(stillSet.rows[0].billing_alert_sent_at).not.toBeNull();

    // Un succès clôt la panne : le prochain incident redonnera droit à un email.
    await completeJob(jobId, { status: "done", rowsInserted: 3 });
    const cleared = await pool.query(`select billing_alert_sent_at from projects where id = $1`, [projectId]);
    expect(cleared.rows[0].billing_alert_sent_at).toBeNull();
  });

  it("sendFailureAlerts is a clean no-op without RESEND_API_KEY", async () => {
    expect(process.env.RESEND_API_KEY).toBeUndefined();
    const result = await sendFailureAlerts();
    expect(result).toEqual({ skipped: true, alerted: 0 });
  });

  it("getProjectJobHealth reports both the latest job and the last successful run", async () => {
    const health = await getProjectJobHealth(projectId);
    expect(health.latestJob?.status).toBe("done");
    expect(health.lastSuccessAt).toBeTruthy();
  });
});
