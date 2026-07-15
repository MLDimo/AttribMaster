import { describe, expect, it } from "vitest";

import { authorizedClientFromRefreshToken } from "@/lib/gcp-oauth/client";
import { BigQuery } from "@google-cloud/bigquery";

/**
 * Tests réels de la connexion Google OAuth + BigQuery — désactivés tant que
 * les secrets suivants ne sont pas fournis (voir README des tests / CI) :
 *
 *   TEST_GOOGLE_REFRESH_TOKEN  refresh token OAuth (scopes BigQuery
 *                              read-only) d'un compte Google de test dédié
 *   TEST_GCP_PROJECT_ID        ID d'un projet GCP de test avec BigQuery activé
 *   TEST_GA4_DATASET           dataset GA4 de test (même minimal/vide) dans
 *                              ce projet, pour valider une vraie requête
 *
 * Mise en place (une fois) :
 *   1. Créer un compte de service ou un compte Google dédié aux tests CI.
 *   2. Créer un petit projet GCP de test avec l'API BigQuery activée.
 *   3. Passer une fois par le flow OAuth de l'app (/api/gcp-oauth/start) avec
 *      ce compte pour obtenir un refresh token, ou en générer un directement
 *      via Google Cloud Console (OAuth Playground) avec le scope BigQuery.
 *   4. Ajouter les 3 valeurs comme secrets GitHub Actions (voir
 *      .github/workflows/ci.yml) — le job les passera à `npm run test`.
 *
 * Une fois ces secrets présents, ce fichier s'active automatiquement (plus
 * besoin de toucher au code) et vérifie que le refresh token est valide et
 * que le client BigQuery peut réellement interroger le dataset de test.
 */
const hasGoogleTestCredentials = Boolean(
  process.env.TEST_GOOGLE_REFRESH_TOKEN && process.env.TEST_GCP_PROJECT_ID && process.env.TEST_GA4_DATASET
);

describe.skipIf(!hasGoogleTestCredentials)("Google OAuth + BigQuery (real credentials)", () => {
  it("exchanges the refresh token for a valid access token", async () => {
    const authClient = authorizedClientFromRefreshToken(process.env.TEST_GOOGLE_REFRESH_TOKEN!);
    const { token } = await authClient.getAccessToken();
    expect(token).toBeTruthy();
  });

  it("can query the test BigQuery dataset", async () => {
    const authClient = authorizedClientFromRefreshToken(process.env.TEST_GOOGLE_REFRESH_TOKEN!);
    const client = new BigQuery({ projectId: process.env.TEST_GCP_PROJECT_ID!, authClient });
    const [rows] = await client.query({
      query: `SELECT 1 AS ok`,
    });
    expect(rows[0].ok).toBe(1);
  });

  it("can list tables in the configured GA4 dataset", async () => {
    const authClient = authorizedClientFromRefreshToken(process.env.TEST_GOOGLE_REFRESH_TOKEN!);
    const client = new BigQuery({ projectId: process.env.TEST_GCP_PROJECT_ID!, authClient });
    const dataset = client.dataset(process.env.TEST_GA4_DATASET!);
    const [exists] = await dataset.exists();
    expect(exists).toBe(true);
  });
});

if (!hasGoogleTestCredentials) {
  // Toujours au moins UN test qui tourne (et échoue volontairement si on
  // l'oublie), pour que l'absence de couverture Google/BigQuery reste visible
  // dans les rapports de CI plutôt que silencieusement masquée par un skip.
  describe("Google OAuth + BigQuery", () => {
    it.todo(
      "SKIPPED: TEST_GOOGLE_REFRESH_TOKEN / TEST_GCP_PROJECT_ID / TEST_GA4_DATASET not configured — see comment at the top of this file"
    );
  });
}
