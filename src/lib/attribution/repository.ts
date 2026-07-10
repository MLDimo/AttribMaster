import { getBigQueryClientForProject, ATTRIBUTIONS_TABLE } from "@/lib/bigquery/client";
import type { AttributionRow, Touchpoint } from "./types";

type BigQueryTimestampLike = { value: string };
type BigQueryDateLike = { value: string };

type RawTouchpoint = {
  source: string;
  medium: string;
  campaign: string | null;
  timestamp: BigQueryTimestampLike | string;
  position: number;
};

type RawAttributionRow = {
  transaction_id: string;
  user_pseudo_id: string;
  event_date: BigQueryDateLike | string;
  event_timestamp: BigQueryTimestampLike | string;
  purchase_revenue: number;
  currency: string | null;
  source_path: string;
  touchpoints: RawTouchpoint[];
};

function unwrap(value: { value: string } | string): string {
  return typeof value === "string" ? value : value.value;
}

function normalizeTouchpoint(raw: RawTouchpoint): Touchpoint {
  return {
    source: raw.source,
    medium: raw.medium,
    campaign: raw.campaign,
    timestamp: unwrap(raw.timestamp),
    position: raw.position,
  };
}

function normalizeRow(raw: RawAttributionRow): AttributionRow {
  return {
    transaction_id: raw.transaction_id,
    user_pseudo_id: raw.user_pseudo_id,
    event_date: unwrap(raw.event_date),
    event_timestamp: unwrap(raw.event_timestamp),
    purchase_revenue: raw.purchase_revenue,
    currency: raw.currency ?? "",
    source_path: raw.source_path,
    touchpoints: (raw.touchpoints ?? []).map(normalizeTouchpoint),
  };
}

export type DateRange = { from: string; to: string };

/** Horodatage de la transaction la plus récente, pour juger de la fraîcheur des données. */
export async function getLastDataTimestamp(projectId: string): Promise<string | null> {
  const { client, project } = await getBigQueryClientForProject(projectId);
  const table = `\`${project.gcp_project_id}.${project.bigquery_dataset}.${ATTRIBUTIONS_TABLE}\``;

  const [rows] = await client.query({
    query: `SELECT MAX(event_timestamp) AS last_event_timestamp FROM ${table}`,
  });
  const value = (rows[0] as { last_event_timestamp: BigQueryTimestampLike | string | null })
    .last_event_timestamp;
  return value ? unwrap(value) : null;
}

export async function getAttributionRows(
  projectId: string,
  { from, to }: DateRange
): Promise<AttributionRow[]> {
  const { client, project } = await getBigQueryClientForProject(projectId);
  const table = `\`${project.gcp_project_id}.${project.bigquery_dataset}.${ATTRIBUTIONS_TABLE}\``;

  const [rows] = await client.query({
    query: `
      SELECT transaction_id, user_pseudo_id, event_date, event_timestamp,
             purchase_revenue, currency, source_path, touchpoints
      FROM ${table}
      WHERE event_date BETWEEN @from AND @to
    `,
    params: { from, to },
    types: { from: "DATE", to: "DATE" },
  });
  return (rows as RawAttributionRow[]).map(normalizeRow);
}

export type TransactionsQuery = DateRange & {
  search?: string;
  page: number;
  pageSize: number;
  sortBy?: "purchase_revenue" | "event_timestamp";
  sortDir?: "asc" | "desc";
};

export type TransactionsPage = {
  rows: AttributionRow[];
  total: number;
};

export async function getTransactions(
  projectId: string,
  {
    from,
    to,
    search,
    page,
    pageSize,
    sortBy = "event_timestamp",
    sortDir = "desc",
  }: TransactionsQuery
): Promise<TransactionsPage> {
  const { client, project } = await getBigQueryClientForProject(projectId);
  const table = `\`${project.gcp_project_id}.${project.bigquery_dataset}.${ATTRIBUTIONS_TABLE}\``;

  const searchFilter = search ? "AND transaction_id LIKE @search" : "";
  const params: Record<string, string | number> = { from, to };
  const types: Record<string, string> = { from: "DATE", to: "DATE" };
  if (search) {
    params.search = `%${search}%`;
    types.search = "STRING";
  }

  const [countRows] = await client.query({
    query: `
      SELECT COUNT(*) AS total
      FROM ${table}
      WHERE event_date BETWEEN @from AND @to ${searchFilter}
    `,
    params,
    types,
  });
  const total = Number((countRows[0] as { total: number | string }).total);

  const orderColumn = sortBy === "purchase_revenue" ? "purchase_revenue" : "event_timestamp";
  const orderDirection = sortDir === "asc" ? "ASC" : "DESC";

  const [rows] = await client.query({
    query: `
      SELECT transaction_id, user_pseudo_id, event_date, event_timestamp,
             purchase_revenue, currency, source_path, touchpoints
      FROM ${table}
      WHERE event_date BETWEEN @from AND @to ${searchFilter}
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT @limit OFFSET @offset
    `,
    params: { ...params, limit: pageSize, offset: (page - 1) * pageSize },
    types: { ...types, limit: "INT64", offset: "INT64" },
  });

  return { rows: (rows as RawAttributionRow[]).map(normalizeRow), total };
}
