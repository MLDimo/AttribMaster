import crypto from "node:crypto";

import bcrypt from "bcryptjs";

import { getDbPool } from "@/lib/db/client";
import { hasEmailSending, sendEmail } from "@/lib/email/resend";

const VERIFICATION_TOKEN_TTL_HOURS = 24;

export class EmailAlreadyUsedError extends Error {
  constructor() {
    super("Email already used");
    this.name = "EmailAlreadyUsedError";
  }
}

export type RegisterResult = {
  userId: string;
  /**
   * true quand aucune vérification n'est requise (pas de RESEND_API_KEY :
   * dev/preprod) — le compte est utilisable immédiatement. En prod, false :
   * l'utilisateur doit cliquer le lien reçu par email avant de se connecter.
   */
  autoVerified: boolean;
};

/**
 * Inscription email/mot de passe. L'email n'est PAS vérifié à la création :
 * sans cette étape, n'importe qui pourrait pré-enregistrer l'adresse d'un
 * tiers (et via le lien automatique de compte Google, en garder l'accès).
 * verifyCredentials refuse les comptes non vérifiés.
 */
export async function registerUser(
  name: string,
  email: string,
  password: string,
  origin: string
): Promise<RegisterResult> {
  const db = getDbPool();
  const normalizedEmail = email.trim().toLowerCase();

  const { rows: existing } = await db.query(`select 1 from users where lower(email) = $1`, [
    normalizedEmail,
  ]);
  if (existing.length > 0) {
    throw new EmailAlreadyUsedError();
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const autoVerified = !hasEmailSending();
  const { rows } = await db.query<{ id: string }>(
    `insert into users (name, email, password_hash, "emailVerified")
     values ($1, $2, $3, case when $4 then now() else null end)
     returning id`,
    [name.trim(), normalizedEmail, passwordHash, autoVerified]
  );

  if (!autoVerified) {
    const token = await createEmailVerificationToken(normalizedEmail);
    const verifyUrl = `${origin}/api/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}&token=${token}`;
    await sendEmail(
      [normalizedEmail],
      "Confirme ton adresse email — AttribMaster",
      `
        <p>Bonjour${name ? ` ${name.trim()}` : ""},</p>
        <p>Bienvenue sur AttribMaster ! Clique sur le lien ci-dessous pour activer ton compte :</p>
        <p><a href="${verifyUrl}">Confirmer mon adresse email</a></p>
        <p style="color:#8a7967;font-size:13px">Ce lien expire dans ${VERIFICATION_TOKEN_TTL_HOURS} heures. Si tu n'es pas à l'origine de cette inscription, ignore cet email.</p>
      `
    );
  }

  return { userId: rows[0].id, autoVerified };
}

/** Crée (ou remplace) le token de vérification pour un email. */
export async function createEmailVerificationToken(email: string): Promise<string> {
  const db = getDbPool();
  const token = crypto.randomBytes(32).toString("hex");
  await db.query(`delete from verification_token where identifier = $1`, [email]);
  await db.query(
    `insert into verification_token (identifier, token, expires)
     values ($1, $2, now() + make_interval(hours => $3))`,
    [email, token, VERIFICATION_TOKEN_TTL_HOURS]
  );
  return token;
}

/** Consomme un token : marque l'email vérifié si valide et non expiré. */
export async function verifyEmailToken(email: string, token: string): Promise<boolean> {
  const db = getDbPool();
  const { rows } = await db.query(
    `delete from verification_token
     where identifier = $1 and token = $2 and expires > now()
     returning identifier`,
    [email, token]
  );
  if (rows.length === 0) return false;

  await db.query(`update users set "emailVerified" = now() where lower(email) = lower($1)`, [email]);
  return true;
}
