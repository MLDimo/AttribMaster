import { afterAll, describe, expect, it } from "vitest";

import { getDbPool } from "@/lib/db/client";
import { checkRateLimit } from "@/lib/rate-limit";

const KEY = "ci-test:rate-limit";
const EXPIRED_KEY = "ci-test:rate-limit-expired";

describe("checkRateLimit", () => {
  afterAll(async () => {
    const pool = getDbPool();
    await pool.query(`delete from rate_limits where key = any($1)`, [[KEY, EXPIRED_KEY]]);
  });

  it("admits up to the limit then rejects within the window", async () => {
    const pool = getDbPool();
    await pool.query(`delete from rate_limits where key = $1`, [KEY]);

    for (let i = 0; i < 3; i++) {
      expect(await checkRateLimit(KEY, 3, 60)).toBe(true);
    }
    expect(await checkRateLimit(KEY, 3, 60)).toBe(false);
    expect(await checkRateLimit(KEY, 3, 60)).toBe(false);
  });

  it("resets the counter once the window has expired", async () => {
    const pool = getDbPool();
    await pool.query(
      `insert into rate_limits (key, count, window_start) values ($1, 99, now() - interval '2 hours')
       on conflict (key) do update set count = 99, window_start = now() - interval '2 hours'`,
      [EXPIRED_KEY]
    );

    expect(await checkRateLimit(EXPIRED_KEY, 3, 60)).toBe(true); // fenêtre expirée -> repart à 1
  });
});
