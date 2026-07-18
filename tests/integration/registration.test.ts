import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";

import { POST as registerPost } from "@/app/api/auth/register/route";
import { GET as verifyEmailGet } from "@/app/api/auth/verify-email/route";
import { verifyCredentials } from "@/lib/auth/credentials";
import { createEmailVerificationToken } from "@/lib/auth/registration";
import { getDbPool } from "@/lib/db/client";

const EMAIL = "ci-signup-test@attribmaster.com";
const PASSWORD = "a-strong-password-123";

function registerRequest(body: unknown, ip: string) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

// IP unique par run : le rate limit (5/h) ne doit pas faire échouer des runs
// CI rapprochés qui partagent la base preprod.
const RUN_IP = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

describe("public signup", () => {
  afterAll(async () => {
    const pool = getDbPool();
    await pool.query(`delete from verification_token where identifier = $1`, [EMAIL]);
    await pool.query(`delete from workspaces where id in (
      select wm.workspace_id from workspace_members wm
      join users u on u.id = wm.user_id where u.email = $1 and wm.role = 'owner')`, [EMAIL]);
    await pool.query(`delete from users where email = $1`, [EMAIL]);
    await pool.query(`delete from rate_limits where key like 'signup:%'`);
  });

  it("creates an account (auto-verified without RESEND_API_KEY) and the workspace trigger fires", async () => {
    expect(process.env.RESEND_API_KEY).toBeUndefined();
    const res = await registerPost(registerRequest({ name: "CI Signup", email: EMAIL, password: PASSWORD }, RUN_IP));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.autoVerified).toBe(true);

    // Le compte est utilisable immédiatement (env sans email sortant).
    const user = await verifyCredentials(EMAIL, PASSWORD);
    expect(user?.email).toBe(EMAIL);

    // Le trigger DB a créé le workspace personnel.
    const pool = getDbPool();
    const { rows } = await pool.query(
      `select 1 from workspace_members wm join users u on u.id = wm.user_id
       where u.email = $1 and wm.role = 'owner'`,
      [EMAIL]
    );
    expect(rows.length).toBe(1);
  });

  it("rejects a duplicate email with 409", async () => {
    const res = await registerPost(registerRequest({ name: "Dup", email: EMAIL, password: PASSWORD }, RUN_IP));
    expect(res.status).toBe(409);
  });

  it("rejects a weak password with 400", async () => {
    const res = await registerPost(registerRequest({ name: "X", email: "other-ci@attribmaster.com", password: "short" }, RUN_IP));
    expect(res.status).toBe(400);
  });

  it("rate limits registrations per IP", async () => {
    const ip = "10.99.99.99";
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const res = await registerPost(
        registerRequest({ name: "X", email: `flood-${i}@attribmaster.com`, password: "short" }, ip)
      );
      last = res.status;
    }
    expect(last).toBe(429); // bloqué avant même la validation zod
  });

  it("an unverified account cannot log in, then can after clicking the email link", async () => {
    const pool = getDbPool();
    // Simule le chemin prod : compte non vérifié + token en attente.
    await pool.query(`update users set "emailVerified" = null where email = $1`, [EMAIL]);
    expect(await verifyCredentials(EMAIL, PASSWORD)).toBeNull();

    const token = await createEmailVerificationToken(EMAIL);
    const res = await verifyEmailGet(
      new NextRequest(`http://localhost/api/auth/verify-email?email=${encodeURIComponent(EMAIL)}&token=${token}`)
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("verified=1");

    const user = await verifyCredentials(EMAIL, PASSWORD);
    expect(user?.email).toBe(EMAIL);
  });

  it("rejects a bad or replayed verification token", async () => {
    const res = await verifyEmailGet(
      new NextRequest(`http://localhost/api/auth/verify-email?email=${encodeURIComponent(EMAIL)}&token=deadbeef`)
    );
    expect(res.headers.get("location")).toContain("verified=invalid");
  });
});
