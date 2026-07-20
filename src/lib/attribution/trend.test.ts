import { describe, expect, it } from "vitest";

import { buildDailySourceTrend, buildDailyTrend, OTHER_CHANNEL_LABEL } from "./trend";
import type { AttributionRow, Touchpoint } from "./types";

function tp(source: string, medium: string, timestamp: string, position: number): Touchpoint {
  return { source, medium, campaign: null, timestamp, position };
}

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

describe("buildDailySourceTrend", () => {
  it("weighted models: exact per-transaction split, credited to the PURCHASE day (not the touchpoint day)", () => {
    const rows = [
      row({
        event_date: "2026-07-11",
        purchase_revenue: 100,
        touchpoints: [tp("google", "cpc", "2026-07-09T00:00:00Z", 0), tp("direct", "none", "2026-07-11T10:00:00Z", 1)],
      }),
    ];
    const { channels, points } = buildDailySourceTrend(rows, "2026-07-09", "2026-07-11", "linear");

    expect(channels.sort()).toEqual(["direct / none", "google / cpc"]);
    const day9 = points.find((p) => p.date === "2026-07-09")!;
    const day11 = points.find((p) => p.date === "2026-07-11")!;
    // Le crédit du touchpoint du 9 juillet est compté le jour de L'ACHAT (11), pas le 9.
    expect(day9.total).toBe(0);
    expect(day9["google / cpc"]).toBe(0);
    expect(day11.total).toBe(100);
    expect(day11["google / cpc"]).toBeCloseTo(50);
    expect(day11["direct / none"]).toBeCloseTo(50);
  });

  it("every day's channel values sum back to that day's total, for every model", () => {
    const rows = [
      row({
        transaction_id: "a",
        event_date: "2026-07-10",
        purchase_revenue: 80,
        touchpoints: [tp("google", "cpc", "2026-07-08T00:00:00Z", 0), tp("direct", "none", "2026-07-10T00:00:00Z", 1)],
      }),
      row({
        transaction_id: "b",
        event_date: "2026-07-10",
        purchase_revenue: 40,
        touchpoints: [tp("direct", "none", "2026-07-10T00:00:00Z", 0)],
      }),
      row({
        transaction_id: "c",
        event_date: "2026-07-11",
        purchase_revenue: 60,
        touchpoints: [tp("google", "cpc", "2026-07-11T00:00:00Z", 0)],
      }),
    ];
    for (const model of ["last_click", "linear", "u_shape", "time_decay", "markov", "shapley"] as const) {
      const { points } = buildDailySourceTrend(rows, "2026-07-10", "2026-07-11", model);
      for (const point of points) {
        const { date: _date, total, ...bySource } = point;
        const sum = Object.values(bySource).reduce((s, v) => s + v, 0);
        expect(sum, `model=${model} date=${point.date}`).toBeCloseTo(total, 6);
      }
    }
  });

  it("markov/shapley apply the GLOBAL channel share to each day's total (no per-transaction decomposition exists for these models)", () => {
    const rows = [
      row({
        transaction_id: "a",
        event_date: "2026-07-10",
        purchase_revenue: 100,
        touchpoints: [tp("google", "cpc", "2026-07-10T00:00:00Z", 0), tp("direct", "none", "2026-07-10T01:00:00Z", 1)],
      }),
      row({
        transaction_id: "b",
        event_date: "2026-07-11",
        purchase_revenue: 50,
        touchpoints: [tp("google", "cpc", "2026-07-11T00:00:00Z", 0), tp("direct", "none", "2026-07-11T01:00:00Z", 1)],
      }),
    ];
    const { points } = buildDailySourceTrend(rows, "2026-07-10", "2026-07-11", "markov");
    const day10 = points.find((p) => p.date === "2026-07-10")!;
    const day11 = points.find((p) => p.date === "2026-07-11")!;
    // Même parcours les deux jours -> même part globale -> même ratio canal/total les deux jours.
    expect(day10["google / cpc"] / day10.total).toBeCloseTo(day11["google / cpc"] / day11.total, 6);
  });

  it("folds channels beyond the top 6 into \"Autres\", keeping the reconciliation exact", () => {
    const channelDefs = Array.from({ length: 9 }, (_, i) => `src${i}`);
    const rows = channelDefs.map((source, i) =>
      row({
        transaction_id: `t${i}`,
        event_date: "2026-07-10",
        purchase_revenue: 100 - i, // revenus distincts -> classement stable
        touchpoints: [tp(source, "cpc", "2026-07-10T00:00:00Z", 0)],
      })
    );
    const { channels, points } = buildDailySourceTrend(rows, "2026-07-10", "2026-07-10", "linear");

    expect(channels).toHaveLength(7); // 6 canaux + "Autres"
    expect(channels[channels.length - 1]).toBe(OTHER_CHANNEL_LABEL);

    const point = points[0];
    const sum = channels.reduce((s, c) => s + point[c], 0);
    expect(sum).toBeCloseTo(point.total, 6);
    expect(point[OTHER_CHANNEL_LABEL]).toBeGreaterThan(0); // 3 canaux les plus faibles y sont repliés
  });

  it("has no channels and an all-zero total when there are no transactions", () => {
    const { channels, points } = buildDailySourceTrend([], "2026-07-10", "2026-07-11", "linear");
    expect(channels).toEqual([]);
    expect(points.every((p) => p.total === 0)).toBe(true);
  });

  it("keeps the plotted channel set fixed to an explicit `plottedChannels` list even when it doesn't match `rows`' own ranking", () => {
    // Simule le cas d'usage réel : `rows` est déjà scopé par un filtre de
    // canal (donc son propre classement interne serait différent), mais le
    // menu de canaux tracés doit rester celui de la vue non filtrée (voir
    // `rankPlottedChannels` + `/api/overview`) pour que "griser les autres"
    // ne redessine jamais le menu.
    const rows = [
      row({
        transaction_id: "t1",
        event_date: "2026-07-10",
        purchase_revenue: 100,
        touchpoints: [tp("only-source", "cpc", "2026-07-10T00:00:00Z", 0)],
      }),
    ];
    const fixedMenu = ["only-source / cpc", "some-other-channel-not-in-rows", OTHER_CHANNEL_LABEL];
    const { channels, points } = buildDailySourceTrend(rows, "2026-07-10", "2026-07-10", "linear", "source", fixedMenu);

    expect(channels).toEqual(fixedMenu);
    expect(points[0]["only-source / cpc"]).toBeCloseTo(100, 6);
    expect(points[0]["some-other-channel-not-in-rows"]).toBe(0);
  });
});
