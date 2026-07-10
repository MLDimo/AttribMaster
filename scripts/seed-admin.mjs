import { Pool } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password) {
  console.error("Usage: node scripts/seed-admin.mjs <name> <email> <password>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(`alter table users add column if not exists password_hash text`);

const passwordHash = await bcrypt.hash(password, 10);

const { rows } = await pool.query(
  `insert into users (name, email, password_hash)
   values ($1, $2, $3)
   on conflict (email) do update set name = excluded.name, password_hash = excluded.password_hash
   returning id, name, email`,
  [name, email, passwordHash]
);

console.log("Utilisateur admin prêt :", rows[0]);
await pool.end();
