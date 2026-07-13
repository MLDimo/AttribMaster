import fs from "node:fs/promises";
import path from "node:path";

import { getBigQueryClientForProjectAsService } from "@/lib/bigquery/client";
import type { Project } from "@/lib/projects/types";

const DEFAULT_LOOKBACK_DAYS = 90;

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
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
};

/** Exécute le script de nuit pour un seul projet (par défaut: hier). */
export async function runNightlyAttributionForProject(
  projectId: string,
  targetDate: string = toDateOnly(new Date(Date.now() - 24 * 60 * 60 * 1000)),
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS
): Promise<NightlyRunResult> {
  const { client, project } = await getBigQueryClientForProjectAsService(projectId);
  const sql = await loadSql("nightly_attribution.sql", project);

  const [job] = await client.createQueryJob({
    query: sql,
    // Le paramètre DATE doit être encapsulé via client.date(...) : passer une
    // simple string avec `types: { target_date: "DATE" }` est silencieusement
    // interprété comme NULL par l'API BigQuery (bug constaté en prod : le
    // script tournait sans erreur mais n'insérait jamais aucune ligne, car
    // `_TABLE_SUFFIX BETWEEN NULL AND NULL` ne matche jamais rien).
    params: { target_date: client.date(targetDate), lookback_days: lookbackDays },
    types: { lookback_days: "INT64" },
  });

  await job.getQueryResults();
  // Requête multi-statement (DECLARE + DELETE + INSERT) = un "script job" :
  // les dmlStats vivent sur les jobs enfants, pas sur le job parent.
  const [childJobs] = await client.getJobs({ parentJobId: job.id });
  const childMetadata = await Promise.all(childJobs.map((j) => j.getMetadata()));
  const insertStats = childMetadata
    .map(([meta]) => meta)
    .find((meta) => meta?.statistics?.query?.statementType === "INSERT")
    ?.statistics?.query?.dmlStats;
  const rowsInserted = Number(insertStats?.insertedRowCount ?? 0);

  return { projectId, projectName: project.name, targetDate, rowsInserted };
}
