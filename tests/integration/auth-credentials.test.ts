import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { verifyCredentials } from "@/lib/auth/credentials";
import { isLockedOut, MAX_ATTEMPTS, recordFailedLogin } from "@/lib/auth/login-throttle";
import { getDbPool } from "@/lib/db/client";

const TEST_EMAIL = "ci-auth-test@attribmaster.com";
const TEST_PASSWORD = "correct-horse-battery-staple";
// Email dédié aux tests de verrouillage : ne JAMAIS réutiliser TEST_EMAIL ici,
// sinon on verrouille l'utilisateur des autres tests.
const THROTTLE_EMAIL = "ci-throttle-test@attribmaster.com";

async function resetThrottle(emails: string[]) {
  const pool = getDbPool();
  await pool.query(`delete from login_throttle where email = any($1)`, [emails]);
}

describe("verifyCredentials (real DB)", () => {
  beforeAll(async () => {
    const pool = getDbPool();
    const hash = await bcrypt.hash(TEST_PASSWORD, 10);
    await pool.query(
      `insert into users (name, email, password_hash, "emailVerified")
       values ($1, $2, $3, now())
       on conflict (email) do update set password_hash = excluded.password_hash, "emailVerified" = now()`,
      ["CI Auth Test", TEST_EMAIL, hash]
    );
    // Des runs CI rapprochés accumulent des échecs pour le même email de test :
    // on repart d'un compteur vierge pour ne pas s'auto-verrouiller.
    await resetThrottle([TEST_EMAIL, THROTTLE_EMAIL, "nobody-such-user@attribmaster.com"]);
  });

  afterAll(async () => {
    const pool = getDbPool();
    await resetThrottle([TEST_EMAIL, THROTTLE_EMAIL, "nobody-such-user@attribmaster.com"]);
    await pool.query(`delete from users where email = $1`, [TEST_EMAIL]);
  });

  it("rejects a wrong password", async () => {
    const user = await verifyCredentials(TEST_EMAIL, "wrong-password");
    expect(user).toBeNull();
  });

  it("rejects an unknown email", async () => {
    const user = await verifyCredentials("nobody-such-user@attribmaster.com", TEST_PASSWORD);
    expect(user).toBeNull();
  });

  it("rejects non-string inputs gracefully", async () => {
    expect(await verifyCredentials(undefined, undefined)).toBeNull();
    expect(await verifyCredentials(123, {})).toBeNull();
  });

  it("accepts the correct email/password pair, and a success clears the failure counter", async () => {
    const user = await verifyCredentials(TEST_EMAIL, TEST_PASSWORD);
    expect(user).not.toBeNull();
    expect(user?.email).toBe(TEST_EMAIL);

    // Le "wrong password" plus haut avait créé un compteur : le succès doit
    // l'avoir purgé.
    const pool = getDbPool();
    const { rows } = await pool.query(`select 1 from login_throttle where email = $1`, [TEST_EMAIL]);
    expect(rows).toHaveLength(0);
  });

  it(`locks the account after ${MAX_ATTEMPTS} failed attempts, even with the right password`, async () => {
    const pool = getDbPool();
    const hash = await bcrypt.hash(TEST_PASSWORD, 10);
    await pool.query(
      `insert into users (name, email, password_hash, "emailVerified") values ($1, $2, $3, now())
       on conflict (email) do update set password_hash = excluded.password_hash, "emailVerified" = now()`,
      ["CI Throttle Test", THROTTLE_EMAIL, hash]
    );
    try {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        expect(await verifyCredentials(THROTTLE_EMAIL, "definitely-wrong")).toBeNull();
      }
      expect(await isLockedOut(THROTTLE_EMAIL)).toBe(true);
      // Verrouillé : même le BON mot de passe est refusé pendant la fenêtre.
      expect(await verifyCredentials(THROTTLE_EMAIL, TEST_PASSWORD)).toBeNull();
    } finally {
      await pool.query(`delete from users where email = $1`, [THROTTLE_EMAIL]);
    }
  });

  it("failed attempts on an unknown email also count (no user-enumeration shortcut)", async () => {
    const email = "ci-throttle-unknown@attribmaster.com";
    await resetThrottle([email]);
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await recordFailedLogin(email);
    }
    expect(await isLockedOut(email)).toBe(true);
    await resetThrottle([email]);
  });
});
