import { Pool } from "@neondatabase/serverless";

let pool: Pool | undefined;

/** Pool Neon partagé (réutilisé entre invocations serverless à chaud). */
export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}
