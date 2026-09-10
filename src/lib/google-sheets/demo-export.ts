import { getMockRows } from "@/lib/attribution/mock-data";
import { getProjectOAuthToken } from "@/lib/projects/repository";
import { exportTransactionsToSheet, getSheetPreview, parseSpreadsheetId } from "./client";

/**
 * Export nocturne du jeu de données démo vers un Google Sheet précis, à la
 * demande de Martin — la seule donnée qui existe réellement dans le système
 * en ce moment, puisque le seul vrai projet client ("trench fresh BQ") a sa
 * facturation GCP coupée par décision (voir CLAUDE.md/mémoire), et qu'aucun
 * autre projet n'a de compte de facturation actif. Ce n'est PAS le mécanisme
 * générique `projects.export_google_sheet_url` (réservé à un vrai projet
 * connecté) : le projet démo (`MOCK_PROJECT_ID`) court-circuite
 * délibérément toute lecture/écriture en base, donc rien à y accrocher.
 *
 * Le jeton OAuth utilisé pour écrire appartient au projet "Molted"
 * (id ci-dessous), PAS au projet démo lui-même (qui n'a pas de vraie
 * connexion Google) : c'est au 2026-09-06 le SEUL projet connecté dont le
 * jeton porte le scope `spreadsheets` (les autres projets connectés
 * n'avaient pas encore ce scope au moment de leur connexion — voir le
 * commentaire dans lib/gcp-oauth/client.ts — et devraient se reconnecter
 * pour l'obtenir). Si "Molted" est un jour déconnecté ou son jeton révoqué,
 * cet export s'arrêtera silencieusement (best-effort, voir l'appelant) :
 * choisir alors un autre projet déjà reconnecté avec le scope Sheets.
 */
const DEMO_EXPORT_SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/1TS7Ngtz2RLGC0euPvDKaakmRWMI89pS4SrRaImp15YA/edit?gid=0#gid=0";
const DEMO_EXPORT_TOKEN_SOURCE_PROJECT_ID = "07f5ced7-3ce8-4cca-803d-2cae755335c6";

export type DemoGoogleSheetExportStatus = {
  spreadsheetUrl: string;
  /** null si le jeton source est indisponible ou si l'appel Google échoue — jamais une exception. */
  spreadsheetTitle: string | null;
  rowCount: number | null;
};

/** Même largeur que l'export nocturne des vrais projets (voir SHEET_EXPORT_LOOKBACK_DAYS dans nightly-run.ts). */
const DEMO_EXPORT_LOOKBACK_DAYS = 90;

function daysAgoDateOnly(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Renvoie le nombre de lignes exportées, ou null si le jeton source n'est plus disponible (projet déconnecté). */
export async function runDemoGoogleSheetExport(): Promise<number | null> {
  const spreadsheetId = parseSpreadsheetId(DEMO_EXPORT_SPREADSHEET_URL);
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
 * de Google (le scope `spreadsheets` n'a autrement aucune surface visible
 * sans compte client réel connecté). N'écrit jamais rien ; échoue en douceur
 * (title/rowCount à null) plutôt que de lever, pour ne jamais faire planter
 * le rendu de la page démo si le jeton source est un jour révoqué.
 */
export async function getDemoGoogleSheetExportStatus(): Promise<DemoGoogleSheetExportStatus> {
  const base = { spreadsheetUrl: DEMO_EXPORT_SPREADSHEET_URL, spreadsheetTitle: null, rowCount: null };
  try {
    const spreadsheetId = parseSpreadsheetId(DEMO_EXPORT_SPREADSHEET_URL);
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
