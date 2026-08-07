import { auth, sheets } from "@googleapis/sheets";

import { channelLabel, type AttributionDimension } from "@/lib/attribution/dimension";
import type { AttributionRow } from "@/lib/attribution/types";

/** Onglet dédié créé/géré par l'app — jamais le premier onglet de la feuille, pour ne jamais écraser des données/formules déjà présentes chez l'utilisateur. */
export const EXPORT_SHEET_TAB_NAME = "AttribMaster";

/**
 * Extrait l'ID de feuille d'une URL Google Sheets classique
 * (https://docs.google.com/spreadsheets/d/ID/edit#gid=0). Renvoie null si
 * l'URL ne correspond pas au format attendu.
 */
export function parseSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * `@googleapis/sheets` embarque sa PROPRE copie de google-auth-library
 * (version distincte, non dédupliquée par npm) : un `OAuth2Client` construit
 * avec le package top-level (utilisé pour BigQuery ailleurs dans l'app)
 * n'est pas assignable ici — on reconstruit donc le client via l'espace de
 * noms `auth` de ce package, avec les mêmes identifiants/refresh token.
 */
function createSheetsAuthClient(refreshToken: string) {
  const client = new auth.OAuth2({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

async function ensureExportTabExists(
  sheetsApi: ReturnType<typeof sheets>,
  spreadsheetId: string
): Promise<void> {
  const { data } = await sheetsApi.spreadsheets.get({ spreadsheetId });
  const exists = data.sheets?.some((s) => s.properties?.title === EXPORT_SHEET_TAB_NAME);
  if (!exists) {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: EXPORT_SHEET_TAB_NAME } } }] },
    });
  }
}

/**
 * Vérifie que la feuille est accessible en écriture avec ce refresh token —
 * utilisé à l'enregistrement de l'URL pour donner un retour immédiat (URL
 * invalide, pas d'accès, ou jeton pas encore reconnecté avec le scope
 * Sheets) plutôt que de découvrir l'échec silencieusement la nuit suivante.
 */
export async function verifySheetAccess(refreshToken: string, spreadsheetId: string): Promise<void> {
  const sheetsApi = sheets({ version: "v4", auth: createSheetsAuthClient(refreshToken) });
  await ensureExportTabExists(sheetsApi, spreadsheetId);
}

/**
 * Remplace intégralement le contenu de l'onglet dédié par les transactions
 * fournies (DELETE+INSERT logique, pas un ajout) : idempotent, jamais de
 * doublon même si le job tourne deux fois pour la même nuit.
 */
export async function exportTransactionsToSheet(
  refreshToken: string,
  spreadsheetId: string,
  rows: AttributionRow[],
  dimension: AttributionDimension = "source"
): Promise<number> {
  const sheetsApi = sheets({ version: "v4", auth: createSheetsAuthClient(refreshToken) });
  await ensureExportTabExists(sheetsApi, spreadsheetId);

  const header = ["transaction_id", "date", "horodatage", "revenu", "devise", "parcours", "nb_touchpoints"];
  const values = [
    header,
    ...rows.map((row) => [
      row.transaction_id,
      row.event_date,
      row.event_timestamp,
      row.purchase_revenue,
      row.currency,
      row.touchpoints.map((tp) => channelLabel(tp, dimension)).join(" > "),
      row.touchpoints.length,
    ]),
  ];

  await sheetsApi.spreadsheets.values.clear({ spreadsheetId, range: EXPORT_SHEET_TAB_NAME });
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: `${EXPORT_SHEET_TAB_NAME}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  return rows.length;
}
