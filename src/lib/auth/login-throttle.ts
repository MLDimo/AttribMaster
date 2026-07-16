import { getDbPool } from "@/lib/db/client";

/**
 * Anti brute-force du login par mot de passe, par email ciblé : après
 * MAX_ATTEMPTS échecs dans la fenêtre, le compte est verrouillé
 * LOCKOUT_MINUTES (pendant lesquelles on ne teste même plus le mot de passe).
 * Le compteur repart de zéro si le dernier échec date de plus d'une fenêtre,
 * et la ligne est supprimée au premier login réussi.
 */
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export async function isLockedOut(email: string): Promise<boolean> {
  const db = getDbPool();
  const { rows } = await db.query<{ locked: boolean }>(
    `select (locked_until is not null and locked_until > now()) as locked
     from login_throttle where email = $1`,
    [email]
  );
  return rows[0]?.locked ?? false;
}

export async function recordFailedLogin(email: string): Promise<void> {
  const db = getDbPool();
  await db.query(
    `insert into login_throttle (email, failed_attempts, updated_at)
     values ($1, 1, now())
     on conflict (email) do update set
       failed_attempts = case
         when login_throttle.updated_at < now() - interval '${LOCKOUT_MINUTES} minutes' then 1
         else login_throttle.failed_attempts + 1
       end,
       locked_until = case
         when (case
           when login_throttle.updated_at < now() - interval '${LOCKOUT_MINUTES} minutes' then 1
           else login_throttle.failed_attempts + 1
         end) >= ${MAX_ATTEMPTS} then now() + interval '${LOCKOUT_MINUTES} minutes'
         else null
       end,
       updated_at = now()`,
    [email]
  );
}

export async function clearLoginFailures(email: string): Promise<void> {
  const db = getDbPool();
  await db.query(`delete from login_throttle where email = $1`, [email]);
}
