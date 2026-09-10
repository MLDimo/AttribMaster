import { getMockRows } from "@/lib/attribution/mock-data";
import { getDbPool } from "@/lib/db/client";
import { getProjectOAuthToken } from "@/lib/projects/repository";
import { exportTransactionsToSheet, getSheetPreview, parseSpreadsheetId } from "./client";

/**
 * Export nocturne du jeu de données démo vers un Google Sheet, à la demande
 * de Martin — la seule donnée qui existe réellement dans le système en ce
 * moment, le seul vrai projet client ("trench fresh BQ") ayant sa facturation
 * GCP coupée par décision (voir CLAUDE.md/mémoire).
 *
 * Le projet démo (`MOCK_PROJECT_ID`) n'a jamais de vraie connexion Google —
 * il court-circuite délibérément toute lecture/écriture en base — donc rien
 * à y accrocher directement. Le jeton ET l'URL de la feuille viennent d'un
 * projet DÉDIÉ à cet usage interne uniquement ("Jeton export démo", id
 * ci-dessous), créé exprès pour ne PAS dépendre d'un vrai projet client (ne
 * plus réutiliser le token de "Molted" comme avant — la feuille visée s'y
 * change comme sur n'importe quel projet, via /manage → Export Google Sheets
 * → sélecteur Google). Si ce projet est un jour déconnecté ou n'a pas encore
 * de feuille choisie, l'export s'arrête silencieusement (best-effort, voir
 * l'appelant), sans jamais affecter les vrais projets clients.
 */
const DEMO_EXPORT_TOKEN_SOURCE_PROJECT_ID = "49bb2b76-f701-4ae4-885e-0a6b280fd0b1";

export type DemoGoogleSheetExportStatus = {
  spreadsheetUrl: string | null;
  /** null si aucune feuille n'est encore choisie, si le jeton est indisponible, ou si l'appel Google échoue — jamais une exception. */
  spreadsheetTitle: string | null;
  rowCount: number | null;
};

/** Même largeur que l'export nocturne des vrais projets (voir SHEET_EXPORT_LOOKBACK_DAYS dans nightly-run.ts). */
const DEMO_EXPORT_LOOKBACK_DAYS = 90;

function daysAgoDateOnly(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function getDemoExportTargetUrl(): Promise<string | null> {
  const db = getDbPool();
  const { rows } = await db.query<{ export_google_sheet_url: string | null }>(
    `select export_google_sheet_url from projects where id = $1`,
    [DEMO_EXPORT_TOKEN_SOURCE_PROJECT_ID]
  );
  return rows[0]?.export_google_sheet_url ?? null;
}

/** Renvoie le nombre de lignes exportées, ou null si rien n'est encore configuré (feuille pas choisie, projet source déconnecté). */
export async function runDemoGoogleSheetExport(): Promise<number | null> {
  const url = await getDemoExportTargetUrl();
  if (!url) return null;
  const spreadsheetId = parseSpreadsheetId(url);
  if (!spreadsheetId) return null;

  const refreshToken = await getProjectOAuthToken(DEMO_EXPORT_TOKEN_SOURCE_PROJECT_ID);
  if (!refreshToken) return null;

  const from = daysAgoDateOnly(DEMO_EXPORT_LOOKBACK_DAYS);
  const rows = getMockRows().filter((row) => row.event_date >= from);
  return exportTransactionsToSheet(refreshToken, spreadsheetId, rows);
}

/**
 * Statut en LECTURE SEULE de cette connexion, pour l'afficher sur la page du
 * projet démo — la preuve visuelle à montrer à l'équipe de vérification OAuth
 * de Google (le scope `drive.file` n'a autrement aucune surface visible sans
 * compte client réel connecté). N'écrit jamais rien ; échoue en douceur
 * (title/rowCount à null) plutôt que de lever, pour ne jamais faire planter
 * le rendu de la page démo si le jeton source est un jour révoqué.
 */
export async function getDemoGoogleSheetExportStatus(): Promise<DemoGoogleSheetExportStatus> {
  const url = await getDemoExportTargetUrl();
  const base = { spreadsheetUrl: url, spreadsheetTitle: null, rowCount: null };
  try {
    if (!url) return base;
    const spreadsheetId = parseSpreadsheetId(url);
    if (!spreadsheetId) return base;
    const refreshToken = await getProjectOAuthToken(DEMO_EXPORT_TOKEN_SOURCE_PROJECT_ID);
    if (!refreshToken) return base;
    const preview = await getSheetPreview(refreshToken, spreadsheetId);
    return { ...base, spreadsheetTitle: preview.title, rowCount: preview.rowCount };
  } catch (error) {
    console.error("[demo-export] failed to read live sheet status", error);
    return base;
  }
}
