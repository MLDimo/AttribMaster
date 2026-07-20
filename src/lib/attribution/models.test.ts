import { describe, expect, it } from "vitest";

import {
  aggregateCreditsBySource,
  computeRowSharePercents,
  computeWeights,
} from "./models";
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

describe("computeWeights", () => {
  it("last_click gives 100% to the last touchpoint", () => {
    const touchpoints = [
      tp("google", "cpc", "t1", 0),
      tp("direct", "none", "t2", 1),
      tp("email", "newsletter", "t3", 2),
    ];
    expect(computeWeights(touchpoints, "last_click")).toEqual([0, 0, 1]);
  });

  it("linear splits equally across all touchpoints, including duplicates", () => {
    const touchpoints = [tp("a", "m", "t1", 0), tp("b", "m", "t2", 1), tp("b", "m", "t3", 2)];
    const weights = computeWeights(touchpoints, "linear");
    weights.forEach((w) => expect(w).toBeCloseTo(1 / 3));
    expect(weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1);
  });

  it("u_shape gives 40/40 to first/last and splits the remaining 20% across the middle", () => {
    const touchpoints = [tp("a", "m", "t1", 0), tp("b", "m", "t2", 1), tp("c", "m", "t3", 2), tp("d", "m", "t4", 3)];
    const weights = computeWeights(touchpoints, "u_shape");
    expect(weights[0]).toBeCloseTo(0.4);
    expect(weights[3]).toBeCloseTo(0.4);
    expect(weights[1]).toBeCloseTo(0.1);
    expect(weights[2]).toBeCloseTo(0.1);
  });

  it("u_shape with exactly 2 touchpoints splits 50/50", () => {
    const touchpoints = [tp("a", "m", "t1", 0), tp("b", "m", "t2", 1)];
    expect(computeWeights(touchpoints, "u_shape")).toEqual([0.5, 0.5]);
  });

  it("time_decay gives more weight to touchpoints closer to the purchase", () => {
    const touchpoints = [
      tp("old", "m", "2026-07-01T00:00:00Z", 0),
      tp("recent", "m", "2026-07-10T23:00:00Z", 1),
    ];
    // Le dernier touchpoint (juste avant l'achat, à t2) est aussi la référence
    // de purchaseTime dans l'implémentation (dernier élément du tableau).
    const weights = computeWeights(touchpoints, "time_decay");
    expect(weights[1]).toBeGreaterThan(weights[0]);
    expect(weights[0] + weights[1]).toBeCloseTo(1);
  });

  it("a single touchpoint always gets 100% regardless of model", () => {
    const touchpoints = [tp("solo", "m", "t1", 0)];
    for (const model of ["last_click", "linear", "u_shape", "time_decay"] as const) {
      expect(computeWeights(touchpoints, model)).toEqual([1]);
    }
  });

  it("an empty touchpoint list returns no weights", () => {
    expect(computeWeights([], "linear")).toEqual([]);
  });
});

describe("aggregateCreditsBySource — weighted models", () => {
  it("linear splits a single multi-touch transaction correctly", () => {
    const rows: AttributionRow[] = [
      row({
        purchase_revenue: 100,
        touchpoints: [tp("google", "cpc", "t1", 0), tp("direct", "none", "t2", 1)],
      }),
    ];
    const credits = aggregateCreditsBySource(rows, "linear");
    const google = credits.find((c) => c.source === "google / cpc");
    const direct = credits.find((c) => c.source === "direct / none");
    expect(google?.revenue).toBeCloseTo(50);
    expect(direct?.revenue).toBeCloseTo(50);
  });

  it("returns an empty array when there are no transactions", () => {
    expect(aggregateCreditsBySource([], "linear")).toEqual([]);
  });
});

// Jeu de données réel (vérifié à la main sur BigQuery, projet "trench fresh
// BQ", juillet 2026) : sert de test de non-régression pour Markov/Shapley,
// dont les résultats sont contre-intuitifs (66.7/33.3, pas 87/13 comme pour
// les modèles pondérés) mais mathématiquement exacts pour ce dataset.
const KLAVIYO_DIRECT_ROWS: AttributionRow[] = [
  row({
    transaction_id: "7668334199125",
    purchase_revenue: 129.4,
    touchpoints: [
      tp("Klaviyo", "email", "2026-07-10T12:43:40Z", 0),
      tp("(direct)", "(none)", "2026-07-10T16:49:12Z", 1),
      tp("(direct)", "(none)", "2026-07-11T08:53:52Z", 2),
      tp("(direct)", "(none)", "2026-07-11T10:46:27Z", 3),
    ],
  }),
  row({
    transaction_id: "7667127779669",
    purchase_revenue: 124.4,
    touchpoints: [tp("(direct)", "(none)", "2026-07-10T18:06:50Z", 0)],
  }),
];

describe("aggregateCreditsBySource — Markov (removal effect)", () => {
  it("matches the hand-verified 66.7/33.3 split on the Klaviyo/direct dataset", () => {
    const credits = aggregateCreditsBySource(KLAVIYO_DIRECT_ROWS, "markov");
    const direct = credits.find((c) => c.source === "(direct) / (none)");
    const klaviyo = credits.find((c) => c.source === "Klaviyo / email");
    expect(direct?.share).toBeCloseTo(2 / 3, 2);
    expect(klaviyo?.share).toBeCloseTo(1 / 3, 2);
    // Le total doit toujours reconstituer exactement le revenu total.
    const total = credits.reduce((s, c) => s + c.revenue, 0);
    expect(total).toBeCloseTo(253.8, 1);
  });
});

describe("aggregateCreditsBySource — Shapley", () => {
  it("matches the hand-verified 74.5/25.5 split on the Klaviyo/direct dataset", () => {
    const credits = aggregateCreditsBySource(KLAVIYO_DIRECT_ROWS, "shapley");
    const direct = credits.find((c) => c.source === "(direct) / (none)");
    const klaviyo = credits.find((c) => c.source === "Klaviyo / email");
    expect(direct?.share).toBeCloseTo(0.745, 2);
    expect(klaviyo?.share).toBeCloseTo(0.255, 2);
  });
});

describe("aggregateCreditsBySource — grouping dimension", () => {
  it("dimension \"medium\" merges different sources sharing the same support (payant vs organique)", () => {
    const rows: AttributionRow[] = [
      row({
        purchase_revenue: 100,
        touchpoints: [tp("google", "cpc", "t1", 0), tp("direct", "none", "t2", 1)],
      }),
      row({
        purchase_revenue: 100,
        touchpoints: [tp("bing", "cpc", "t1", 0)],
      }),
    ];
    const credits = aggregateCreditsBySource(rows, "linear", "medium");
    // google/cpc + bing/cpc doivent fusionner sous "cpc", plus jamais visibles
    // séparément par source une fois regroupés par support.
    expect(credits.find((c) => c.source === "google")).toBeUndefined();
    expect(credits.find((c) => c.source === "bing")).toBeUndefined();
    const cpc = credits.find((c) => c.source === "cpc");
    expect(cpc?.revenue).toBeCloseTo(150); // 50 (moitié du 1er) + 100 (entier du 2nd)
  });

  it("dimension \"campaign\" groups by campaign and buckets missing campaigns under the sentinel label", () => {
    const rows: AttributionRow[] = [
      row({
        purchase_revenue: 100,
        touchpoints: [
          tp("google", "cpc", "t1", 0, "brand-search"),
          tp("bing", "cpc", "t2", 1, "brand-search"),
        ],
      }),
      row({
        purchase_revenue: 100,
        touchpoints: [tp("direct", "none", "t1", 0, null)],
      }),
    ];
    const credits = aggregateCreditsBySource(rows, "linear", "campaign");
    const brandSearch = credits.find((c) => c.source === "brand-search");
    expect(brandSearch?.revenue).toBeCloseTo(100); // les deux touchpoints de la même campagne, même transaction
    const noCampaign = credits.find((c) => c.source === "(sans campagne)");
    expect(noCampaign?.revenue).toBeCloseTo(100);
  });

  it("defaults to the historical source+medium grouping when no dimension is passed", () => {
    const rows: AttributionRow[] = [
      row({ purchase_revenue: 100, touchpoints: [tp("google", "cpc", "t1", 0)] }),
    ];
    const credits = aggregateCreditsBySource(rows, "linear");
    expect(credits[0].source).toBe("google / cpc");
  });

  it("markov also respects the grouping dimension (collapses consecutive same-medium touchpoints as one state)", () => {
    const rows: AttributionRow[] = [
      row({
        purchase_revenue: 100,
        touchpoints: [
          tp("google", "cpc", "2026-07-10T00:00:00Z", 0),
          tp("bing", "cpc", "2026-07-10T01:00:00Z", 1),
          tp("direct", "none", "2026-07-10T02:00:00Z", 2),
        ],
      }),
      row({
        purchase_revenue: 100,
        touchpoints: [tp("direct", "none", "2026-07-11T00:00:00Z", 0)],
      }),
    ];
    const credits = aggregateCreditsBySource(rows, "markov", "medium");
    const total = credits.reduce((s, c) => s + c.revenue, 0);
    expect(total).toBeCloseTo(200, 1);
    expect(credits.some((c) => c.source === "cpc")).toBe(true);
    expect(credits.some((c) => c.source === "none")).toBe(true);
  });
});

describe("computeRowSharePercents", () => {
  it("is exact per-transaction for weighted models", () => {
    const touchpoints = [tp("a", "m", "t1", 0), tp("b", "m", "t2", 1)];
    const shares = computeRowSharePercents(touchpoints, "linear", []);
    expect(shares).toEqual([50, 50]);
  });

  it("returns the GLOBAL share for markov/shapley, not a per-transaction redistribution", () => {
    // Régression directe du bug corrigé cette session : le tooltip affichait
    // un faux "14%" pour Klaviyo alors que sa part globale réelle est 33.3%.
    const credits = aggregateCreditsBySource(KLAVIYO_DIRECT_ROWS, "markov");
    const touchpoints = KLAVIYO_DIRECT_ROWS[0].touchpoints; // Klaviyo + 3x direct
    const shares = computeRowSharePercents(touchpoints, "markov", credits);
    const klaviyoShare = credits.find((c) => c.source === "Klaviyo / email")!.share * 100;
    expect(shares[0]).toBeCloseTo(klaviyoShare, 1);
    // Chaque occurrence de "(direct) / (none)" doit aussi afficher la part
    // globale identique, pas une valeur différente par occurrence.
    expect(shares[1]).toBeCloseTo(shares[2]);
    expect(shares[2]).toBeCloseTo(shares[3]);
  });
});
