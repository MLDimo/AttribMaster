import crypto from "node:crypto";

import bcrypt from "bcryptjs";

import { clearLoginFailures } from "@/lib/auth/login-throttle";
import { getDbPool } from "@/lib/db/client";
import { hasEmailSending, sendEmail } from "@/lib/email/resend";

/**
 * Réinitialisation de mot de passe par email. Les tokens vivent dans la table
 * verification_token de NextAuth, avec un identifier préfixé "reset:" pour ne
 * jamais entrer en collision avec les tokens de confirmation d'inscription.
 * Fenêtre courte (1h) : un lien de reset qui traîne est une porte d'entrée.
 */
const RESET_TOKEN_TTL_MINUTES = 60;

function resetIdentifier(email: string): string {
  return `reset:${email.trim().toLowerCase()}`;
}

export async function createPasswordResetToken(email: string): Promise<string> {
  const db = getDbPool();
  const token = crypto.randomBytes(32).toString("hex");
  const identifier = resetIdentifier(email);
  await db.query(`delete from verification_token where identifier = $1`, [identifier]);
  await db.query(
    `insert into verification_token (identifier, token, expires)
     values ($1, $2, now() + make_interval(mins => $3))`,
    [identifier, token, RESET_TOKEN_TTL_MINUTES]
  );
  return token;
}

/**
 * Demande de réinitialisation : n'indique JAMAIS si le compte existe
 * (anti-énumération). Envoie l'email uniquement si un utilisateur correspond.
 * Fonctionne aussi pour un compte créé via Google sans mot de passe : cliquer
 * le lien (preuve de possession de l'email) permet d'en définir un.
 */
export async function requestPasswordReset(email: string, origin: string): Promise<void> {
  if (!hasEmailSending()) {
    // Dev/preprod sans clé Resend : impossible d'envoyer le lien. On ne crée
    // pas de token orphelin (les tests appellent createPasswordResetToken).
    return;
  }

  const db = getDbPool();
  const normalizedEmail = email.trim().toLowerCase();
  const { rows } = await db.query(`select 1 from users where lower(email) = $1`, [normalizedEmail]);
  if (rows.length === 0) {
    return;
  }

  const token = await createPasswordResetToken(normalizedEmail);
  const resetUrl = `${origin}/reset-password?email=${encodeURIComponent(normalizedEmail)}&token=${token}`;
  await sendEmail(
    [normalizedEmail],
    "Réinitialise ton mot de passe — AttribMaster",
    `
      <p>Bonjour,</p>
      <p>Une réinitialisation de mot de passe a été demandée pour ton compte AttribMaster.</p>
      <p><a href="${resetUrl}">Choisir un nouveau mot de passe</a></p>
      <p style="color:#8a7967;font-size:13px">Ce lien expire dans 1 heure. Si tu n'es pas à l'origine de cette demande, ignore cet email — ton mot de passe reste inchangé.</p>
    `
  );
}

/** Consomme le token et applique le nouveau mot de passe. */
export async function resetPassword(
  email: string,
  token: string,
  newPassword: string
): Promise<boolean> {
  const db = getDbPool();
  const normalizedEmail = email.trim().toLowerCase();
  const { rows } = await db.query(
    `delete from verification_token
     where identifier = $1 and token = $2 and expires > now()
     returning identifier`,
    [resetIdentifier(normalizedEmail), token]
  );
  if (rows.length === 0) return false;

  const passwordHash = await bcrypt.hash(newPassword, 10);
  // Le lien prouve la possession de l'email : on marque aussi le compte
  // vérifié (utile si le reset arrive avant la confirmation d'inscription).
  const { rowCount } = await db.query(
    `update users set password_hash = $2, "emailVerified" = coalesce("emailVerified", now())
     where lower(email) = $1`,
    [normalizedEmail, passwordHash]
  );
  if ((rowCount ?? 0) === 0) return false;

  await clearLoginFailures(normalizedEmail);
  return true;
}
