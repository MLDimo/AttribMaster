import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { verifyCredentials } from "@/lib/auth/credentials";
import { getDbPool } from "@/lib/db/client";

const TEST_EMAIL = "ci-auth-test@attribmaster.com";
const TEST_PASSWORD = "correct-horse-battery-staple";

describe("verifyCredentials (real DB)", () => {
  beforeAll(async () => {
    const pool = getDbPool();
    const hash = await bcrypt.hash(TEST_PASSWORD, 10);
    await pool.query(
      `insert into users (name, email, password_hash)
       values ($1, $2, $3)
       on conflict (email) do update set password_hash = excluded.password_hash`,
      ["CI Auth Test", TEST_EMAIL, hash]
    );
  });

  afterAll(async () => {
    const pool = getDbPool();
    await pool.query(`delete from users where email = $1`, [TEST_EMAIL]);
  });

  it("accepts the correct email/password pair", async () => {
    const user = await verifyCredentials(TEST_EMAIL, TEST_PASSWORD);
    expect(user).not.toBeNull();
    expect(user?.email).toBe(TEST_EMAIL);
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
});
