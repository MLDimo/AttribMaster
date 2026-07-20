import { getBigQueryClientForProject, ATTRIBUTIONS_TABLE } from "@/lib/bigquery/client";
import { TtlCache } from "@/lib/cache/ttl-cache";
import { getDbPool } from "@/lib/db/client";
import { requireUserId } from "@/lib/projects/repository";
import { channelLabel, NO_CAMPAIGN_LABEL, type AttributionDimension } from "./dimension";
import { getMockRows, MOCK_PROJECT_ID } from "./mock-data";
import type { AttributionRow, Touchpoint } from "./types";

export type ChannelFilter = { dimension: AttributionDimension; value: string };

/**
 * Les données d'attribution ne changent qu'au rythme des jobs (cron nocturne
 * ou refresh manuel), mais chaque affichage du dashboard relançait les
 * requêtes BigQuery (1-3s de latence + coût par octet scanné). On met donc
 * les résultats en cache mémoire, avec dans la clé la date du dernier job
 * réussi du projet : un refresh qui aboutit change cette date, donc la clé,
 * donc invalide le cache sur toutes les instances sans coordination. La
 * vérification d'accès (getBigQueryClientForProject) reste TOUJOURS exécutée
 * avant toute lecture du cache.
 */
const queryCache = new TtlCache<unknown>(5 * 60 * 1000, 100);

async function freshnessStamp(projectId: string): Promise<string> {
  const db = getDbPool();
  const { rows } = await db.query<{ stamp: string | null }>(
    `select max(finished_at)::text as stamp from nightly_jobs
     where project_id = $1 and status = 'done'`,
    [projectId]
  );
  return rows[0]?.stamp ?? "never";
}

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = queryCache.get(key);
  if (hit !== undefined) return hit as T;
  const value = await fetcher();
  queryCache.set(key, value);
  return value;
}

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
  if (projectId === MOCK_PROJECT_ID) {
    // Mode démo : lecture seule, mais toujours réservée aux utilisateurs connectés.
    await requireUserId();
    const rows = getMockRows();
    return rows.length > 0 ? rows[rows.length - 1].event_timestamp : null;
  }

  const { client, project } = await getBigQueryClientForProject(projectId);
  const table = `\`${project.gcp_project_id}.${project.bigquery_dataset}.${ATTRIBUTIONS_TABLE}\``;

  const stamp = await freshnessStamp(projectId);
  return cached(`last-data:${projectId}:${stamp}`, async () => {
    const [rows] = await client.query({
      query: `SELECT MAX(event_timestamp) AS last_event_timestamp FROM ${table}`,
    });
    const value = (rows[0] as { last_event_timestamp: BigQueryTimestampLike | string | null })
      .last_event_timestamp;
    return value ? unwrap(value) : null;
  });
}

export async function getAttributionRows(
  projectId: string,
  { from, to }: DateRange
): Promise<AttributionRow[]> {
  if (projectId === MOCK_PROJECT_ID) {
    await requireUserId();
    return getMockRows().filter((row) => row.event_date >= from && row.event_date <= to);
  }

  const { client, project } = await getBigQueryClientForProject(projectId);
  const table = `\`${project.gcp_project_id}.${project.bigquery_dataset}.${ATTRIBUTIONS_TABLE}\``;

  const stamp = await freshnessStamp(projectId);
  return cached(`rows:${projectId}:${from}:${to}:${stamp}`, async () => {
    const [rows] = await client.query({
      query: `
        SELECT transaction_id, user_pseudo_id, event_date, event_timestamp,
               purchase_revenue, currency, source_path, touchpoints
        FROM ${table}
        WHERE event_date BETWEEN @from AND @to
      `,
      // client.date(...) est requis : une string brute + `types: "DATE"` est
      // silencieusement liée à NULL par l'API BigQuery (voir nightly-run.ts).
      params: { from: client.date(from), to: client.date(to) },
    });
    return (rows as RawAttributionRow[]).map(normalizeRow);
  });
}

export type TransactionsQuery = DateRange & {
  search?: string;
  page: number;
  pageSize: number;
  sortBy?: "purchase_revenue" | "event_timestamp";
  sortDir?: "asc" | "desc";
  /** Ne garde que les transactions ayant au moins un touchpoint matchant. */
  channel?: ChannelFilter;
};

export type TransactionsPage = {
  rows: AttributionRow[];
  total: number;
};

function matchesChannel(row: AttributionRow, channel: ChannelFilter): boolean {
  return row.touchpoints.some((tp) => channelLabel(tp, channel.dimension) === channel.value);
}

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
    channel,
  }: TransactionsQuery
): Promise<TransactionsPage> {
  if (projectId === MOCK_PROJECT_ID) {
    await requireUserId();
    let rows = getMockRows().filter((row) => row.event_date >= from && row.event_date <= to);
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((row) => row.transaction_id.toLowerCase().includes(needle));
    }
    if (channel) {
      rows = rows.filter((row) => matchesChannel(row, channel));
    }
    const orderColumn = sortBy === "purchase_revenue" ? "purchase_revenue" : "event_timestamp";
    const direction = sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => (a[orderColumn] < b[orderColumn] ? -1 : a[orderColumn] > b[orderColumn] ? 1 : 0) * direction);
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return { rows: rows.slice(start, start + pageSize), total };
  }

  const { client, project } = await getBigQueryClientForProject(projectId);
  const table = `\`${project.gcp_project_id}.${project.bigquery_dataset}.${ATTRIBUTIONS_TABLE}\``;

  const stamp = await freshnessStamp(projectId);
  const channelKey = channel ? `${channel.dimension}:${channel.value}` : "";
  return cached(
    `tx:${projectId}:${from}:${to}:${search ?? ""}:${channelKey}:${page}:${pageSize}:${sortBy}:${sortDir}:${stamp}`,
    () => fetchTransactionsPage(client, table, { from, to, search, page, pageSize, sortBy, sortDir, channel })
  );
}

/**
 * `EXISTS (... UNNEST(touchpoints) ...)` : ne garde que les transactions
 * ayant au moins un touchpoint matchant la dimension choisie. "source" est
 * comparé via CONCAT (comme `channelLabel`/`source_path`) plutôt que de
 * découper `@channelValue` en JS, pour rester robuste si source/medium
 * contenaient eux-mêmes " / ".
 */
function buildChannelFilterClause(channel?: ChannelFilter): {
  clause: string;
  params: Record<string, unknown>;
  types: Record<string, string>;
} {
  if (!channel) return { clause: "", params: {}, types: {} };
  if (channel.dimension === "medium") {
    return {
      clause: "AND EXISTS (SELECT 1 FROM UNNEST(touchpoints) t WHERE t.medium = @channelValue)",
      params: { channelValue: channel.value },
      types: { channelValue: "STRING" },
    };
  }
  if (channel.dimension === "campaign") {
    if (channel.value === NO_CAMPAIGN_LABEL) {
      return {
        clause: "AND EXISTS (SELECT 1 FROM UNNEST(touchpoints) t WHERE t.campaign IS NULL)",
        params: {},
        types: {},
      };
    }
    return {
      clause: "AND EXISTS (SELECT 1 FROM UNNEST(touchpoints) t WHERE t.campaign = @channelValue)",
      params: { channelValue: channel.value },
      types: { channelValue: "STRING" },
    };
  }
  return {
    clause: "AND EXISTS (SELECT 1 FROM UNNEST(touchpoints) t WHERE CONCAT(t.source, ' / ', t.medium) = @channelValue)",
    params: { channelValue: channel.value },
    types: { channelValue: "STRING" },
  };
}

async function fetchTransactionsPage(
  client: Awaited<ReturnType<typeof getBigQueryClientForProject>>["client"],
  table: string,
  {
    from,
    to,
    search,
    page,
    pageSize,
    sortBy,
    sortDir,
    channel,
  }: Required<Omit<TransactionsQuery, "search" | "channel">> & Pick<TransactionsQuery, "search" | "channel">
): Promise<TransactionsPage> {
  const searchFilter = search ? "AND transaction_id LIKE @search" : "";
  const channelFilter = buildChannelFilterClause(channel);
  // client.date(...) est requis : une string brute + `types: "DATE"` est
  // silencieusement liée à NULL par l'API BigQuery (voir nightly-run.ts).
  const params: Record<string, unknown> = {
    from: client.date(from),
    to: client.date(to),
    ...channelFilter.params,
  };
  const types: Record<string, string> = { ...channelFilter.types };
  if (search) {
    params.search = `%${search}%`;
    types.search = "STRING";
  }

  const [countRows] = await client.query({
    query: `
      SELECT COUNT(*) AS total
      FROM ${table}
      WHERE event_date BETWEEN @from AND @to ${searchFilter} ${channelFilter.clause}
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
      WHERE event_date BETWEEN @from AND @to ${searchFilter} ${channelFilter.clause}
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT @limit OFFSET @offset
    `,
    params: { ...params, limit: pageSize, offset: (page - 1) * pageSize },
    types: { ...types, limit: "INT64", offset: "INT64" },
  });

  return { rows: (rows as RawAttributionRow[]).map(normalizeRow), total };
}
