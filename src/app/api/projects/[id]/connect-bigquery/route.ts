import fs from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { yesterdayDateOnly } from "@/lib/attribution/nightly-run";
import { enqueueHistoricalBackfill, processQueue } from "@/lib/attribution/queue";
import { discoverGa4HistoryStartDate } from "@/lib/bigquery/client";
import { authorizedClientFromRefreshToken } from "@/lib/gcp-oauth/client";
import { connectProjectBigQuery, getProject, getProjectOAuthToken } from "@/lib/projects/repository";
import { BigQuery } from "@google-cloud/bigquery";
import { apiErrorResponse } from "@/lib/auth/errors";

// Sans ça, la fonction serverless est tuée avant d'avoir pu drainer une partie
// du rattrapage d'historique juste après la connexion. Plafonné automatiquement
// à la limite du plan si celui-ci autorise moins que 60s.
export const maxDuration = 60;

const bodySchema = z.object({
  gcpProjectId: z.string().trim().min(1),
  ga4Dataset: z.string().trim().min(1),
  bigqueryDataset: z.string().trim().min(1).optional(),
});

/** Best effort : crée le dataset + la table d'attribution s'ils n'existent pas. */
async function provisionAttributionsTable(
  bigquery: BigQuery,
  gcpProjectId: string,
  bigqueryDataset: string,
  ga4Dataset: string
) {
  const dataset = bigquery.dataset(bigqueryDataset);
  const [exists] = await dataset.exists();
  if (!exists) {
    // Le dataset d'attribution doit être dans la même location que l'export
    // GA4 : BigQuery interdit de joindre/écrire entre deux datasets situés
    // dans des locations différentes (sinon "createDataset" retombe sur la
    // location par défaut "US", qui casse la requête si le GA4 export est
    // ailleurs, ex: europe-west1).
    const [ga4Metadata] = await bigquery.dataset(ga4Dataset).getMetadata();
    await bigquery.createDataset(bigqueryDataset, { location: ga4Metadata.location });
  }

  const ddlPath = path.join(process.cwd(), "sql", "create_attributions_table.sql");
  const ddl = (await fs.readFile(ddlPath, "utf8")).replaceAll(
    "@project.@dataset",
    `${gcpProjectId}.${bigqueryDataset}`
  );
  await bigquery.query({ query: ddl });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let project, refreshToken;
  try {
    project = await getProject(id);
    refreshToken = await getProjectOAuthToken(id);
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/connect-bigquery]", "Failed to load project");
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found or not accessible" }, { status: 404 });
  }
  if (!refreshToken) {
    return NextResponse.json({ error: "BigQuery not connected yet" }, { status: 400 });
  }

  const bigqueryDataset = parsed.data.bigqueryDataset ?? "attribution";
  const authClient = authorizedClientFromRefreshToken(refreshToken);
  const bigquery = new BigQuery({ projectId: parsed.data.gcpProjectId, authClient });

  try {
    await provisionAttributionsTable(bigquery, parsed.data.gcpProjectId, bigqueryDataset, parsed.data.ga4Dataset);
  } catch (error) {
    // Non bloquant : le dataset/table peuvent être créés manuellement plus tard.
    console.error("[api/projects/[id]/connect-bigquery] provisioning failed", error);
  }

  let updated;
  try {
    updated = await connectProjectBigQuery(id, {
      gcpProjectId: parsed.data.gcpProjectId,
      ga4Dataset: parsed.data.ga4Dataset,
      bigqueryDataset,
    });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/connect-bigquery]", "Failed to connect BigQuery");
  }

  // Rattrapage de tout l'historique GA4 disponible (best effort, non bloquant
  // pour la connexion elle-même) : enfile un job par jour depuis le premier
  // export disponible jusqu'à hier, puis draine tout de suite ce que le
  // budget de temps permet. Le reste continuera d'être traité par le cron
  // nocturne (claimNextJob ne distingue pas la source des jobs en attente).
  let backfill: { enqueuedDays: number; processedNow: number } | null = null;
  try {
    const startDate = await discoverGa4HistoryStartDate(
      bigquery,
      parsed.data.gcpProjectId,
      parsed.data.ga4Dataset
    );
    if (startDate) {
      const endDate = yesterdayDateOnly();
      const enqueuedDays = await enqueueHistoricalBackfill(id, startDate, endDate);
      const { processed } = await processQueue(Date.now() + 40_000, id);
      backfill = { enqueuedDays, processedNow: processed };
    }
  } catch (error) {
    // Non bloquant : le rattrapage pourra être relancé plus tard (bouton
    // Actualiser, ou prochain tick de cron une fois des jours en attente).
    console.error("[api/projects/[id]/connect-bigquery] historical backfill failed", error);
  }

  return NextResponse.json({ project: updated, backfill });
}
