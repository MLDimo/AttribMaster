import fs from "node:fs/promises";
import path from "node:path";

import type { BigQuery } from "@google-cloud/bigquery";

import { getBigQueryClientForProjectAsService } from "@/lib/bigquery/client";
import type { Project } from "@/lib/projects/types";

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

export type NightlyRunResult = {
  projectId: string;
  projectName: string;
  targetDate: string;
  rowsInserted: number;
  sessionsRowsInserted: number;
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

  return { projectId, projectName: project.name, targetDate, rowsInserted, sessionsRowsInserted };
}
