import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { getDbPool } from "@/lib/db/client";

const EXPECTED_TABLES = [
  "accounts",
  "billing_accounts",
  "custom_plan_requests",
  "nightly_jobs",
  "project_members",
  "projects",
  "sessions",
  "users",
  "verification_token",
  "workspace_members",
  "workspace_projects",
  "workspaces",
];

// Colonnes-clé dont le code applicatif dépend directement : si l'une d'elles
// disparaît ou change de type, une bonne partie de l'app casse silencieusement.
const EXPECTED_COLUMNS: Record<string, string[]> = {
  projects: [
    "id",
    "name",
    "gcp_project_id",
    "ga4_dataset",
    "bigquery_dataset",
    "oauth_refresh_token_encrypted",
    "billing_account_id",
    "plan",
    "billing_interval",
    "stripe_subscription_id",
    "subscription_status",
  ],
  nightly_jobs: [
    "id",
    "project_id",
    "target_date",
    "status",
    "trigger_source",
    "rows_inserted",
    "error",
  ],
  billing_accounts: ["id", "workspace_id", "name", "stripe_customer_id"],
  users: ["id", "name", "email", "password_hash"],
};

describe("database schema", () => {
  it("has every table the application code relies on", async () => {
    const pool = getDbPool();
    const { rows } = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public'`
    );
    const tableNames = new Set(rows.map((r) => r.table_name));
    for (const table of EXPECTED_TABLES) {
      expect(tableNames.has(table), `missing table: ${table}`).toBe(true);
    }
  });

  it.each(Object.entries(EXPECTED_COLUMNS))("table %s has its expected columns", async (table, columns) => {
    const pool = getDbPool();
    const { rows } = await pool.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = $1`,
      [table]
    );
    const columnNames = new Set(rows.map((r) => r.column_name));
    for (const column of columns) {
      expect(columnNames.has(column), `missing column: ${table}.${column}`).toBe(true);
    }
  });

  it("re-applying every migration file is a no-op (idempotency check)", async () => {
    const pool = getDbPool();
    const dir = path.join(process.cwd(), "db/migrations");
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const sql = await fs.readFile(path.join(dir, file), "utf8");
      // Ne doit jamais lever (create/alter ... if not exists partout) : si ça
      // casse ici, une migration a été écrite de façon non ré-applicable.
      await expect(pool.query(sql), file).resolves.toBeDefined();
    }
  });

  it("nightly_jobs enforces one job per project+day", async () => {
    const pool = getDbPool();
    const { rows } = await pool.query<{ indexdef: string }>(
      `select indexdef from pg_indexes where tablename = 'nightly_jobs'`
    );
    const hasUniqueConstraint = rows.some(
      (r) => r.indexdef.includes("UNIQUE") && r.indexdef.includes("project_id") && r.indexdef.includes("target_date")
    );
    expect(hasUniqueConstraint).toBe(true);
  });
});
