import { describe, expect, it } from "vitest";

import { computeChannelPerformance, type ChannelSessionCount } from "./channel-performance";
import type { AttributionRow, Touchpoint } from "./types";

function tp(
  source: string,
  medium: string,
  timestamp: string,
  position: number,
  campaign: string | null = null
): Touchpoint {
  return { source, medium, campaign, timestamp, position };
}

function row(overrides: Partial<AttributionRow> & { touchpoints: Touchpoint[] }): AttributionRow {
  return {
    transaction_id: "tx",
    user_pseudo_id: "user",
    event_date: "2026-07-11",
    event_timestamp: "2026-07-11T10:00:00Z",
    purchase_revenue: 100,
    currency: "EUR",
    source_path: "",
    ...overrides,
  };
}

function sessions(source: string, medium: string, count: number, campaign: string | null = null): ChannelSessionCount {
  return { source, medium, campaign, sessions: count };
}

describe("computeChannelPerformance", () => {
  it("computes conversion rate as transactions / sessions", () => {
    const rows = [
      row({ transaction_id: "t1", touchpoints: [tp("google", "cpc", "t", 0)] }),
      row({ transaction_id: "t2", touchpoints: [tp("google", "cpc", "t", 0)] }),
    ];
    const counts = [sessions("google", "cpc", 100)];

    const result = computeChannelPerformance(rows, counts, "source");
    const google = result.find((r) => r.channel === "google / cpc");
    expect(google?.sessions).toBe(100);
    expect(google?.transactions).toBe(2);
    expect(google?.conversionRate).toBeCloseTo(2 / 100, 6);
  });

  it("computes average order value as the FULL (non attribution-weighted) revenue of touched transactions divided by their count", () => {
    const rows = [
      // Une transaction multi-touch : "email" est présent mais ne devrait
      // recevoir QUE 100 en revenu (le montant réel de la commande), pas une
      // fraction pondérée par un modèle — ce n'est pas un crédit d'attribution.
      row({ transaction_id: "t1", purchase_revenue: 100, touchpoints: [tp("google", "cpc", "t", 0), tp("email", "newsletter", "t", 1)] }),
      row({ transaction_id: "t2", purchase_revenue: 300, touchpoints: [tp("google", "cpc", "t", 0)] }),
    ];
    const counts = [sessions("google", "cpc", 10), sessions("email", "newsletter", 5)];

    const result = computeChannelPerformance(rows, counts, "source");
    const google = result.find((r) => r.channel === "google / cpc");
    const email = result.find((r) => r.channel === "email / newsletter");
    expect(google?.transactions).toBe(2);
    expect(google?.avgOrderValue).toBeCloseTo((100 + 300) / 2, 6);
    expect(email?.transactions).toBe(1);
    expect(email?.avgOrderValue).toBeCloseTo(100, 6); // pas 50 (la moitié pondérée) : le vrai montant de la commande
  });

  it("counts a transaction only once per channel even if the channel appears as multiple touchpoints", () => {
    const rows = [
      row({
        transaction_id: "t1",
        purchase_revenue: 100,
        touchpoints: [tp("google", "cpc", "t", 0), tp("direct", "none", "t", 1), tp("google", "cpc", "t", 2)],
      }),
    ];
    const result = computeChannelPerformance(rows, [], "source");
    const google = result.find((r) => r.channel === "google / cpc");
    expect(google?.transactions).toBe(1); // pas 2
    expect(google?.avgOrderValue).toBe(100);
  });

  it("conversionRate is null when a channel has zero sessions counted, not Infinity or 0", () => {
    const rows = [row({ touchpoints: [tp("google", "cpc", "t", 0)] })];
    const result = computeChannelPerformance(rows, [], "source");
    expect(result.find((r) => r.channel === "google / cpc")?.conversionRate).toBeNull();
  });

  it("avgOrderValue is null when a channel has sessions but zero conversions, not NaN", () => {
    const counts = [sessions("google", "cpc", 50)];
    const result = computeChannelPerformance([], counts, "source");
    const google = result.find((r) => r.channel === "google / cpc");
    expect(google?.transactions).toBe(0);
    expect(google?.avgOrderValue).toBeNull();
    expect(google?.conversionRate).toBe(0); // 0 transactions / 50 sessions = 0%, un vrai zéro, pas null
  });

  it("respects the active grouping dimension (medium groups google/cpc and bing/cpc together)", () => {
    const rows = [
      row({ transaction_id: "t1", touchpoints: [tp("google", "cpc", "t", 0)] }),
      row({ transaction_id: "t2", touchpoints: [tp("bing", "cpc", "t", 0)] }),
    ];
    const counts = [sessions("google", "cpc", 40), sessions("bing", "cpc", 10)];

    const result = computeChannelPerformance(rows, counts, "medium");
    expect(result).toHaveLength(1);
    expect(result[0].channel).toBe("cpc");
    expect(result[0].sessions).toBe(50);
    expect(result[0].transactions).toBe(2);
  });

  it("sorts by sessions descending", () => {
    const counts = [sessions("a", "x", 5), sessions("b", "y", 50), sessions("c", "z", 20)];
    const result = computeChannelPerformance([], counts, "source");
    expect(result.map((r) => r.sessions)).toEqual([50, 20, 5]);
  });
});
