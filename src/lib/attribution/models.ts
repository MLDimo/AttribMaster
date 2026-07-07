import type {
  AttributionModel,
  AttributionRow,
  SourceCredit,
  Touchpoint,
} from "./types";

const TIME_DECAY_HALF_LIFE_DAYS = 7;

/** Poids (somme = 1) attribués à chaque touchpoint, du premier au dernier. */
export function computeWeights(
  touchpoints: Touchpoint[],
  model: AttributionModel
): number[] {
  const n = touchpoints.length;
  if (n === 0) return [];
  if (n === 1) return [1];

  switch (model) {
    case "linear":
      return touchpoints.map(() => 1 / n);

    case "u_shape": {
      if (n === 2) return [0.5, 0.5];
      const middleShare = 0.2 / (n - 2);
      return touchpoints.map((_, i) =>
        i === 0 || i === n - 1 ? 0.4 : middleShare
      );
    }

    case "time_decay": {
      const purchaseTime = new Date(
        touchpoints[touchpoints.length - 1].timestamp
      ).getTime();
      const rawWeights = touchpoints.map((tp) => {
        const daysBeforePurchase =
          (purchaseTime - new Date(tp.timestamp).getTime()) /
          (1000 * 60 * 60 * 24);
        return Math.pow(2, -daysBeforePurchase / TIME_DECAY_HALF_LIFE_DAYS);
      });
      const total = rawWeights.reduce((sum, w) => sum + w, 0);
      return rawWeights.map((w) => w / total);
    }
  }
}

function sourceLabel(touchpoint: Touchpoint): string {
  return `${touchpoint.source} / ${touchpoint.medium}`;
}

/** Agrège le revenu par source pour un modèle d'attribution donné. */
export function aggregateCreditsBySource(
  rows: AttributionRow[],
  model: AttributionModel
): SourceCredit[] {
  const revenueBySource = new Map<string, number>();
  let totalRevenue = 0;

  for (const row of rows) {
    const weights = computeWeights(row.touchpoints, model);
    row.touchpoints.forEach((tp, i) => {
      const credit = row.purchase_revenue * weights[i];
      const label = sourceLabel(tp);
      revenueBySource.set(label, (revenueBySource.get(label) ?? 0) + credit);
    });
    totalRevenue += row.purchase_revenue;
  }

  return Array.from(revenueBySource.entries())
    .map(([source, revenue]) => ({
      source,
      revenue,
      share: totalRevenue > 0 ? revenue / totalRevenue : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
