import bcrypt from "bcryptjs";

import { clearLoginFailures, isLockedOut, recordFailedLogin } from "@/lib/auth/login-throttle";
import { getDbPool } from "@/lib/db/client";

export type CredentialsUser = { id: string; name: string | null; email: string };

/** Vérifie un couple email/mot de passe contre `users.password_hash`. Retourne null si invalide. */
export async function verifyCredentials(
  email: unknown,
  password: unknown
): Promise<CredentialsUser | null> {
  if (typeof email !== "string" || typeof password !== "string") {
    return null;
  }

  // Verrouillé après trop d'échecs : on ne teste même pas le mot de passe,
  // un brute-force ne peut plus rien apprendre pendant la fenêtre.
  if (await isLockedOut(email)) {
    return null;
  }

  const pool = getDbPool();
  const { rows } = await pool.query<{ id: string; name: string | null; email: string; password_hash: string | null }>(
    `select id, name, email, password_hash from users where email = $1`,
    [email]
  );
  const user = rows[0];
  if (!user?.password_hash) {
    await recordFailedLogin(email);
    return null;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await recordFailedLogin(email);
    return null;
  }

  await clearLoginFailures(email);
  return { id: user.id, name: user.name, email: user.email };
}
