import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST as forgotPost } from "@/app/api/auth/forgot-password/route";
import { POST as resetPost } from "@/app/api/auth/reset-password/route";
import { verifyCredentials } from "@/lib/auth/credentials";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { getDbPool } from "@/lib/db/client";

const EMAIL = "ci-reset-test@attribmaster.com";
const OLD_PASSWORD = "old-password-123";
const NEW_PASSWORD = "brand-new-password-456";
const RUN_IP = `10.1.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

function post(handler: typeof forgotPost, url: string, body: unknown) {
  return handler(
    new NextRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": RUN_IP },
      body: JSON.stringify(body),
    })
  );
}

describe("password reset", () => {
  beforeAll(async () => {
    const pool = getDbPool();
    const hash = await bcrypt.hash(OLD_PASSWORD, 10);
    await pool.query(
      `insert into users (name, email, password_hash, "emailVerified") values ($1, $2, $3, now())
       on conflict (email) do update set password_hash = excluded.password_hash, "emailVerified" = now()`,
      ["CI Reset Test", EMAIL, hash]
    );
  });

  afterAll(async () => {
    const pool = getDbPool();
    await pool.query(`delete from verification_token where identifier = $1`, [`reset:${EMAIL}`]);
    await pool.query(`delete from users where email = $1`, [EMAIL]);
    await pool.query(`delete from rate_limits where key like 'forgot%' or key like 'reset:%'`);
  });

  it("forgot-password always answers ok, whether the account exists or not (anti-enumeration)", async () => {
    const known = await post(forgotPost, "http://localhost/api/auth/forgot-password", { email: EMAIL });
    expect(known.status).toBe(200);
    const unknown = await post(forgotPost, "http://localhost/api/auth/forgot-password", {
      email: "nobody-here@attribmaster.com",
    });
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
  });

  it("resets the password with a valid token: old password dies, new one works, throttle cleared", async () => {
    const pool = getDbPool();
    // Simule un compte verrouillé par des tentatives : le reset doit le libérer.
    await pool.query(
      `insert into login_throttle (email, failed_attempts, locked_until) values ($1, 5, now() + interval '15 minutes')
       on conflict (email) do update set locked_until = now() + interval '15 minutes'`,
      [EMAIL]
    );

    const token = await createPasswordResetToken(EMAIL);
    const res = await post(resetPost, "http://localhost/api/auth/reset-password", {
      email: EMAIL,
      token,
      password: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);

    expect(await verifyCredentials(EMAIL, OLD_PASSWORD)).toBeNull();
    const user = await verifyCredentials(EMAIL, NEW_PASSWORD);
    expect(user?.email).toBe(EMAIL);
  });

  it("a token cannot be replayed", async () => {
    const token = await createPasswordResetToken(EMAIL);
    const first = await post(resetPost, "http://localhost/api/auth/reset-password", {
      email: EMAIL,
      token,
      password: "another-password-789",
    });
    expect(first.status).toBe(200);

    const replay = await post(resetPost, "http://localhost/api/auth/reset-password", {
      email: EMAIL,
      token,
      password: "yet-another-password",
    });
    expect(replay.status).toBe(400);
  });

  it("rejects a wrong token and a weak password", async () => {
    const bad = await post(resetPost, "http://localhost/api/auth/reset-password", {
      email: EMAIL,
      token: "deadbeef",
      password: NEW_PASSWORD,
    });
    expect(bad.status).toBe(400);

    const token = await createPasswordResetToken(EMAIL);
    const weak = await post(resetPost, "http://localhost/api/auth/reset-password", {
      email: EMAIL,
      token,
      password: "short",
    });
    expect(weak.status).toBe(400);
  });

  it("a reset token for one email cannot change another account", async () => {
    const token = await createPasswordResetToken(EMAIL);
    const res = await post(resetPost, "http://localhost/api/auth/reset-password", {
      email: "martin04.laroche@gmail.com",
      token,
      password: "hijack-attempt-123",
    });
    expect(res.status).toBe(400); // identifier "reset:<email>" ne matche pas
  });
});
