import { describe, expect, it } from "vitest";

import { aggregateCreditsBySource } from "./models";
import type { AttributionRow, Touchpoint } from "./types";

/**
 * La Valeur de Shapley exacte énumère 2^n sous-ensembles de canaux (voir
 * SHAPLEY_EXACT_MAX_CHANNELS = 12 dans models.ts, au-delà on bascule sur
 * Monte-Carlo). Ce test garantit que la borne exacte (2^12 = 4096
 * sous-ensembles) reste rapide en pratique — une régression algorithmique
 * (ex: recalcul redondant dans la boucle) ferait exploser ce temps.
 */
function tp(source: string, timestamp: string, position: number): Touchpoint {
  return { source, medium: "m", campaign: null, timestamp, position };
}

function buildRowsWithNChannels(channelCount: number, transactionCount: number): AttributionRow[] {
  const channels = Array.from({ length: channelCount }, (_, i) => `channel-${i}`);
  const rows: AttributionRow[] = [];
  for (let i = 0; i < transactionCount; i++) {
    // Chemin variable en longueur/composition pour éviter un cas dégénéré
    // (une seule combinaison de canaux) qui ne stresserait pas vraiment
    // l'énumération des sous-ensembles.
    const pathLength = 1 + (i % channelCount);
    const touchpoints: Touchpoint[] = [];
    for (let p = 0; p < pathLength; p++) {
      const channel = channels[(i + p) % channelCount];
      touchpoints.push(tp(channel, `2026-07-${String((p % 27) + 1).padStart(2, "0")}T00:00:00Z`, p));
    }
    rows.push({
      transaction_id: `perf-${i}`,
      user_pseudo_id: `user-${i}`,
      event_date: "2026-07-15",
      event_timestamp: "2026-07-15T00:00:00Z",
      purchase_revenue: 100 + i,
      currency: "EUR",
      source_path: "",
      touchpoints,
    });
  }
  return rows;
}

describe("Shapley exact — performance at the 12-channel boundary", () => {
  it("computes exact Shapley values for 12 unique channels well under a second", () => {
    const rows = buildRowsWithNChannels(12, 300);

    const start = performance.now();
    const credits = aggregateCreditsBySource(rows, "shapley");
    const elapsedMs = performance.now() - start;

    expect(credits.length).toBeGreaterThan(0);
    expect(credits.length).toBeLessThanOrEqual(12);
    const shareSum = credits.reduce((s, c) => s + c.share, 0);
    expect(shareSum).toBeCloseTo(1, 2);
    credits.forEach((c) => expect(c.share).toBeGreaterThanOrEqual(0));

    // Marge large (budget réel << 1s) pour ne pas rendre le test flaky selon
    // la machine, tout en détectant une vraie régression algorithmique.
    expect(elapsedMs).toBeLessThan(1000);
  });

  it("falls back to Monte Carlo above 12 channels and still returns valid, fast results", () => {
    const rows = buildRowsWithNChannels(20, 150);

    const start = performance.now();
    const credits = aggregateCreditsBySource(rows, "shapley");
    const elapsedMs = performance.now() - start;

    const shareSum = credits.reduce((s, c) => s + c.share, 0);
    expect(shareSum).toBeCloseTo(1, 1);
    expect(elapsedMs).toBeLessThan(2000);
  });
});
