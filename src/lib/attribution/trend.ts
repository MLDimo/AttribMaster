import type { AttributionRow } from "./types";

export type DailyTrendPoint = {
  date: string;
  revenue: number;
  transactions: number;
};

function nextDay(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Revenu et nombre de transactions par jour sur [from, to], un point par jour
 * MÊME quand un jour n'a aucune vente : sans les jours à zéro, une ligne
 * relierait deux jours actifs en travers d'un creux réel et le lecteur ne le
 * verrait jamais (l'intérêt même du graphique est de repérer les creux/pics).
 */
export function buildDailyTrend(rows: AttributionRow[], from: string, to: string): DailyTrendPoint[] {
  const byDate = new Map<string, { revenue: number; transactions: number }>();
  for (const row of rows) {
    const entry = byDate.get(row.event_date) ?? { revenue: 0, transactions: 0 };
    entry.revenue += row.purchase_revenue;
    entry.transactions += 1;
    byDate.set(row.event_date, entry);
  }

  const points: DailyTrendPoint[] = [];
  for (let date = from; date <= to; date = nextDay(date)) {
    const entry = byDate.get(date);
    points.push({ date, revenue: entry?.revenue ?? 0, transactions: entry?.transactions ?? 0 });
  }
  return points;
}
