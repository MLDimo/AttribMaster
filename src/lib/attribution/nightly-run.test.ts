import { describe, expect, it } from "vitest";

import { daysAgoDateOnly, toDateOnly, yesterdayDateOnly } from "./nightly-run";

describe("nightly-run date helpers", () => {
  it("toDateOnly formats a Date as YYYY-MM-DD in UTC", () => {
    expect(toDateOnly(new Date("2026-07-20T23:59:59.000Z"))).toBe("2026-07-20");
    expect(toDateOnly(new Date("2026-07-20T00:00:00.000Z"))).toBe("2026-07-20");
  });

  it("daysAgoDateOnly(0) is today, daysAgoDateOnly(n) is n days before today", () => {
    const today = toDateOnly(new Date());
    expect(daysAgoDateOnly(0)).toBe(today);

    const n = 5;
    const expected = toDateOnly(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
    expect(daysAgoDateOnly(n)).toBe(expected);
  });

  it("yesterdayDateOnly is exactly daysAgoDateOnly(1)", () => {
    expect(yesterdayDateOnly()).toBe(daysAgoDateOnly(1));
  });
});
