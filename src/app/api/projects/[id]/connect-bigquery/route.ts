import fs from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authorizedClientFromRefreshToken } from "@/lib/gcp-oauth/client";
import { connectProjectBigQuery, getProject, getProjectOAuthToken } from "@/lib/projects/repository";
import { BigQuery } from "@google-cloud/bigquery";

const bodySchema = z.object({
  gcpProjectId: z.string().trim().min(1),
  ga4Dataset: z.string().trim().min(1),
  bigqueryDataset: z.string().trim().min(1).optional(),
});

/** Best effort : crée le dataset + la table d'attribution s'ils n'existent pas. */
async function provisionAttributionsTable(
  bigquery: BigQuery,
  gcpProjectId: string,
  bigqueryDataset: string
) {
  const dataset = bigquery.dataset(bigqueryDataset);
  const [exists] = await dataset.exists();
  if (!exists) {
    await bigquery.createDataset(bigqueryDataset);
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

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found or not accessible" }, { status: 404 });
  }

  const refreshToken = await getProjectOAuthToken(id);
  if (!refreshToken) {
    return NextResponse.json({ error: "BigQuery not connected yet" }, { status: 400 });
  }

  const bigqueryDataset = parsed.data.bigqueryDataset ?? "attribution";

  try {
    const authClient = authorizedClientFromRefreshToken(refreshToken);
    const bigquery = new BigQuery({ projectId: parsed.data.gcpProjectId, authClient });
    await provisionAttributionsTable(bigquery, parsed.data.gcpProjectId, bigqueryDataset);
  } catch (error) {
    // Non bloquant : le dataset/table peuvent être créés manuellement plus tard.
    console.error("[api/projects/[id]/connect-bigquery] provisioning failed", error);
  }

  try {
    const updated = await connectProjectBigQuery(id, {
      gcpProjectId: parsed.data.gcpProjectId,
      ga4Dataset: parsed.data.ga4Dataset,
      bigqueryDataset,
    });
    return NextResponse.json({ project: updated });
  } catch (error) {
    console.error("[api/projects/[id]/connect-bigquery]", error);
    return NextResponse.json({ error: "Failed to connect BigQuery" }, { status: 500 });
  }
}
