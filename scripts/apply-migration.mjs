import { Pool } from "@neondatabase/serverless";
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node --env-file=.env scripts/apply-migration.mjs db/migrations/<file>.sql");
  process.exit(1);
}

const sql = fs.readFileSync(file, "utf8");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  console.log(`OK: ${file} applied to ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}`);
} finally {
  await pool.end();
}
