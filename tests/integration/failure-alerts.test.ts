import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findProjectsNeedingFailureAlert, sendFailureAlerts } from "@/lib/alerts/failure-alerts";
import { getProjectJobHealth } from "@/lib/attribution/queue";
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

    // Simule un envoi : le throttle doit exclure le projet du prochain tour.
    await pool.query(`update projects set last_failure_alert_at = now() where id = $1`, [projectId]);
    const after = await findProjectsNeedingFailureAlert();
    expect(after.find((c) => c.project_id === projectId)).toBeUndefined();
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
