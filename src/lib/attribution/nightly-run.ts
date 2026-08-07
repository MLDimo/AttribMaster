import fs from "node:fs/promises";
import path from "node:path";

import type { BigQuery } from "@google-cloud/bigquery";

import { ATTRIBUTIONS_TABLE, getBigQueryClientForProjectAsService } from "@/lib/bigquery/client";
import { exportTransactionsToSheet, parseSpreadsheetId } from "@/lib/google-sheets/client";
import { getProjectOAuthToken, recordGoogleSheetExportResult } from "@/lib/projects/repository";
import type { Project } from "@/lib/projects/types";
import { fetchAttributionRowsForBigQueryClient } from "./repository";

const DEFAULT_LOOKBACK_DAYS = 90;

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysAgoDateOnly(n: number): string {
  return toDateOnly(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

export function yesterdayDateOnly(): string {
  return daysAgoDateOnly(1);
}

async function loadSql(fileName: string, project: Project): Promise<string> {
  const filePath = path.join(process.cwd(), "sql", fileName);
  const raw = await fs.readFile(filePath, "utf8");

  return raw
    .replaceAll("@project.@ga4_dataset", `${project.gcp_project_id}.${project.ga4_dataset}`)
    .replaceAll("@project.@dataset", `${project.gcp_project_id}.${project.bigquery_dataset}`);
}

/** Fenêtre exportée vers Google Sheets à chaque nuit (remplacement complet de l'onglet, pas un ajout) — même largeur que le rattrapage d'attribution, pour rester borné et rapide sous la limite Vercel Hobby (maxDuration 300s). */
const SHEET_EXPORT_LOOKBACK_DAYS = 90;

export type NightlyRunResult = {
  projectId: string;
  projectName: string;
  targetDate: string;
  rowsInserted: number;
  sessionsRowsInserted: number;
  sheetExportedRows: number | null;
};

/**
 * Exécute une requête "script job" (DECLARE + DELETE + INSERT) et renvoie le
 * nombre de lignes insérées. Les dmlStats vivent sur les jobs enfants, pas
 * sur le job parent, d'où le second appel `getJobs`.
 */
async function runScriptJob(
  client: BigQuery,
  query: string,
  params: Record<string, unknown>,
  types?: Record<string, string>
): Promise<number> {
  const [job] = await client.createQueryJob({ query, params, types });
  await job.getQueryResults();
  const [childJobs] = await client.getJobs({ parentJobId: job.id });
  const childMetadata = await Promise.all(childJobs.map((j) => j.getMetadata()));
  const insertStats = childMetadata
    .map(([meta]) => meta)
    .find((meta) => meta?.statistics?.query?.statementType === "INSERT")
    ?.statistics?.query?.dmlStats;
  return Number(insertStats?.insertedRowCount ?? 0);
}

/** Exécute le script de nuit pour un seul projet (par défaut: hier). */
export async function runNightlyAttributionForProject(
  projectId: string,
  targetDate: string = yesterdayDateOnly(),
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS
): Promise<NightlyRunResult> {
  const { client, project } = await getBigQueryClientForProjectAsService(projectId);

  const attributionSql = await loadSql("nightly_attribution.sql", project);
  // Le paramètre DATE doit être encapsulé via client.date(...) : passer une
  // simple string avec `types: { target_date: "DATE" }` est silencieusement
  // interprété comme NULL par l'API BigQuery (bug constaté en prod : le
  // script tournait sans erreur mais n'insérait jamais aucune ligne, car
  // `_TABLE_SUFFIX BETWEEN NULL AND NULL` ne matche jamais rien).
  const rowsInserted = await runScriptJob(
    client,
    attributionSql,
    { target_date: client.date(targetDate), lookback_days: lookbackDays },
    { lookback_days: "INT64" }
  );

  // Comptage des sessions par canal (dénominateur du taux de conversion,
  // voir sql/nightly_channel_sessions.sql) : best-effort, ne fait jamais
  // échouer le job nocturne principal — les lignes d'attribution déjà
  // insérées ci-dessus restent valables même si ce calcul secondaire échoue
  // (table pas encore provisionnée pour un projet connecté avant l'ajout de
  // cette fonctionnalité, erreur transitoire...).
  let sessionsRowsInserted = 0;
  try {
    const sessionsSql = await loadSql("nightly_channel_sessions.sql", project);
    sessionsRowsInserted = await runScriptJob(client, sessionsSql, { target_date: client.date(targetDate) });
  } catch (error) {
    console.error("[nightly-run] channel sessions count failed (non-blocking)", error);
  }

  // Export Google Sheets (best-effort, comme les sessions par canal ci-dessus) :
  // un échec ici (jeton pas encore reconnecté avec le scope Sheets, feuille
  // supprimée, quota Google atteint...) ne doit jamais faire échouer le job
  // nocturne principal, dont les lignes sont déjà insérées et valables.
  let sheetExportedRows: number | null = null;
  if (project.export_google_sheet_url) {
    try {
      const spreadsheetId = parseSpreadsheetId(project.export_google_sheet_url);
      if (!spreadsheetId) throw new Error("URL Google Sheets enregistrée invalide");
      const refreshToken = await getProjectOAuthToken(projectId);
      if (!refreshToken) throw new Error("Aucun token OAuth pour ce projet");

      const table = `\`${project.gcp_project_id}.${project.bigquery_dataset}.${ATTRIBUTIONS_TABLE}\``;
      const rows = await fetchAttributionRowsForBigQueryClient(client, table, {
        from: daysAgoDateOnly(SHEET_EXPORT_LOOKBACK_DAYS),
        to: targetDate,
      });
      sheetExportedRows = await exportTransactionsToSheet(refreshToken, spreadsheetId, rows);
      await recordGoogleSheetExportResult(projectId, null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[nightly-run] google sheet export failed (non-blocking)", error);
      await recordGoogleSheetExportResult(projectId, message);
    }
  }

  return { projectId, projectName: project.name, targetDate, rowsInserted, sessionsRowsInserted, sheetExportedRows };
}
