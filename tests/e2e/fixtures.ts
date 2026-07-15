import bcrypt from "bcryptjs";

import { getDbPool } from "@/lib/db/client";
import { MOCK_PROJECT_ID } from "@/lib/attribution/mock-data";

export const E2E_USER_EMAIL = "e2e-test@attribmaster.com";
export const E2E_USER_PASSWORD = "e2e-test-password-fixture";

/**
 * Fixtures E2E idempotentes : conçues pour persister en base preprod entre
 * les runs (comme "Project mockdata" en prod) plutôt que d'être recréées à
 * chaque fois. Sûr à ré-exécuter à volonté.
 */
export async function seedE2EFixtures(): Promise<void> {
  const pool = getDbPool();

  const passwordHash = await bcrypt.hash(E2E_USER_PASSWORD, 10);
  await pool.query(
    `insert into users (name, email, password_hash)
     values ('E2E Test User', $1, $2)
     on conflict (email) do update set password_hash = excluded.password_hash`,
    [E2E_USER_EMAIL, passwordHash]
  );

  const { rows: userRows } = await pool.query(`select id from users where email = $1`, [E2E_USER_EMAIL]);
  const userId = userRows[0].id;

  // Le workspace personnel est créé automatiquement par le trigger
  // on_user_created lors du tout premier insert — on le récupère ici plutôt
  // que d'en recréer un.
  const { rows: workspaceRows } = await pool.query(
    `select workspace_id from workspace_members where user_id = $1 and role = 'owner' limit 1`,
    [userId]
  );
  const workspaceId = workspaceRows[0].workspace_id;

  // Projet "mockdata" partagé par les tests visuels/dashboard : mêmes données
  // déterministes que la sandbox de démo commerciale en production, jamais
  // connecté à un vrai BigQuery, gratuit (pas d'abonnement Stripe requis).
  await pool.query(
    `insert into projects (id, name, gcp_project_id, ga4_dataset, bigquery_dataset,
       oauth_refresh_token_encrypted, plan, subscription_status)
     values ($1, 'Project mockdata', 'mock-gcp-project', 'analytics_mock', 'attribution',
       'not-a-real-token', 'standard', 'active')
     on conflict (id) do nothing`,
    [MOCK_PROJECT_ID]
  );

  await pool.query(
    `insert into workspace_projects (workspace_id, project_id) values ($1, $2)
     on conflict do nothing`,
    [workspaceId, MOCK_PROJECT_ID]
  );
}
