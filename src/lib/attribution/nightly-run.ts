import fs from "node:fs/promises";
import path from "node:path";

import { getBigQueryClientForProjectAsService } from "@/lib/bigquery/client";
import { listAllProjectsAsService } from "@/lib/projects/repository";
import type { Project } from "@/lib/projects/types";

const DEFAULT_LOOKBACK_DAYS = 90;

function toDateOnly(date: Date): string {
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
    params: { target_date: targetDate, lookback_days: lookbackDays },
    types: { target_date: "DATE", lookback_days: "INT64" },
  });

  await job.getQueryResults();
  const [metadata] = await job.getMetadata();
  const rowsInserted = Number(metadata?.statistics?.query?.dmlStats?.insertedRowCount ?? 0);

  return { projectId, projectName: project.name, targetDate, rowsInserted };
}

export type NightlyRunSummary = {
  succeeded: NightlyRunResult[];
  failed: Array<{ projectId: string; projectName: string; error: string }>;
};

/** Boucle sur tous les projets configurés (V2 : multi-tenant). */
export async function runNightlyAttributionForAllProjects(
  targetDate?: string,
  lookbackDays?: number
): Promise<NightlyRunSummary> {
  const projects = await listAllProjectsAsService();
  const succeeded: NightlyRunResult[] = [];
  const failed: NightlyRunSummary["failed"] = [];

  for (const project of projects) {
    try {
      const result = await runNightlyAttributionForProject(project.id, targetDate, lookbackDays);
      succeeded.push(result);
    } catch (error) {
      failed.push({
        projectId: project.id,
        projectName: project.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { succeeded, failed };
}
