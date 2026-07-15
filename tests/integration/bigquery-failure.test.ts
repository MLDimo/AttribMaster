import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { enqueueJob, getLatestJobForProject, processQueue } from "@/lib/attribution/queue";
import { encryptSecret } from "@/lib/crypto/secrets";
import { getDbPool } from "@/lib/db/client";

/**
 * Simule une révocation d'accès Google (refresh token invalide/révoqué) sans
 * avoir besoin d'un vrai compte Google de test : un refresh token bidon
 * déclenche un vrai rejet "invalid_grant" de l'endpoint OAuth de Google — le
 * même comportement observé en prod avec "Project mockdata" (token mort)
 * cette session. On vérifie que l'échec remonte proprement jusqu'au job
 * nightly_jobs, sans jamais le laisser bloqué en "processing".
 */
describe("nightly job failure handling on a revoked/invalid Google refresh token", () => {
  let projectId: string;

  beforeAll(async () => {
    const pool = getDbPool();
    const { rows } = await pool.query(
      `insert into projects (name, gcp_project_id, ga4_dataset, bigquery_dataset, oauth_refresh_token_encrypted)
       values (
         'CI Invalid Token Test Project',
         'ci-test-gcp-project',
         'analytics_ci_test',
         'attribution',
         $1
       ) returning id`,
      [encryptSecret("1//this-is-not-a-real-refresh-token")]
    );
    projectId = rows[0].id;
  });

  afterAll(async () => {
    const pool = getDbPool();
    await pool.query(`delete from nightly_jobs where project_id = $1`, [projectId]);
    await pool.query(`delete from projects where id = $1`, [projectId]);
  });

  it("marks the job as failed with the underlying Google auth error, never stuck processing", async () => {
    await enqueueJob(projectId, "2026-04-01", "manual");
    const { processed } = await processQueue(Date.now() + 20000);
    expect(processed).toBe(1);

    const job = await getLatestJobForProject(projectId);
    expect(job?.status).toBe("failed");
    expect(job?.finished_at).toBeTruthy();
    // Le message exact dépend de la lib Google, mais doit refléter un rejet
    // d'authentification (invalid_grant / invalid credentials / unauthorized),
    // pas une erreur générique ou silencieuse.
    expect(job?.error).toBeTruthy();
    expect(job?.error?.toLowerCase()).toMatch(/invalid_grant|invalid|unauthorized|token/);
  });
});
