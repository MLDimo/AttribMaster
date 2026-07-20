import { describe, expect, it } from "vitest";

import { buildDailyTrend } from "./trend";
import type { AttributionRow } from "./types";

function row(overrides: Partial<AttributionRow>): AttributionRow {
  return {
    transaction_id: "t1",
    user_pseudo_id: "u1",
    event_date: "2026-07-10",
    event_timestamp: "2026-07-10T12:00:00.000Z",
    purchase_revenue: 100,
    currency: "EUR",
    source_path: "direct / none",
    touchpoints: [],
    ...overrides,
  };
}

describe("buildDailyTrend", () => {
  it("fills every day in the range, including days with zero sales (the gap must show, not be skipped)", () => {
    const rows = [row({ event_date: "2026-07-10", purchase_revenue: 50 })];
    const points = buildDailyTrend(rows, "2026-07-09", "2026-07-12");

    expect(points.map((p) => p.date)).toEqual(["2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12"]);
    expect(points.map((p) => p.revenue)).toEqual([0, 50, 0, 0]);
    expect(points.map((p) => p.transactions)).toEqual([0, 1, 0, 0]);
  });

  it("sums multiple transactions on the same day", () => {
    const rows = [
      row({ transaction_id: "a", event_date: "2026-07-10", purchase_revenue: 30 }),
      row({ transaction_id: "b", event_date: "2026-07-10", purchase_revenue: 20 }),
    ];
    const points = buildDailyTrend(rows, "2026-07-10", "2026-07-10");

    expect(points).toEqual([{ date: "2026-07-10", revenue: 50, transactions: 2 }]);
  });

  it("handles a single-day range", () => {
    const points = buildDailyTrend([], "2026-07-10", "2026-07-10");
    expect(points).toEqual([{ date: "2026-07-10", revenue: 0, transactions: 0 }]);
  });

  it("handles an empty row set over a multi-day range (all zeros, no crash)", () => {
    const points = buildDailyTrend([], "2026-07-01", "2026-07-03");
    expect(points).toEqual([
      { date: "2026-07-01", revenue: 0, transactions: 0 },
      { date: "2026-07-02", revenue: 0, transactions: 0 },
      { date: "2026-07-03", revenue: 0, transactions: 0 },
    ]);
  });

  it("crosses a month boundary correctly", () => {
    const points = buildDailyTrend([], "2026-01-30", "2026-02-02");
    expect(points.map((p) => p.date)).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  });

  it("ignores rows outside the requested range (defensive — callers should already filter)", () => {
    const rows = [row({ event_date: "2026-08-01", purchase_revenue: 999 })];
    const points = buildDailyTrend(rows, "2026-07-01", "2026-07-02");
    expect(points.every((p) => p.revenue === 0)).toBe(true);
  });
});
