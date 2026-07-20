import type { DailySourceTrend, DailyTrendPoint } from "./trend";
import type { AttributionRow, SourceCredit } from "./types";

export type OverviewResponse = {
  range: { from: string; to: string };
  comparison: { from: string; to: string };
  totals: {
    revenue: number;
    transactions: number;
    previousRevenue: number;
    revenueChangePct: number | null;
  };
  topSources: SourceCredit[];
  /** Devises distinctes présentes sur la période : > 1 => totaux non homogènes. */
  currencies: string[];
  /** Un point par jour sur `range`, jours sans vente inclus (à 0). */
  trend: DailyTrendPoint[];
  /** Revenu par jour ET par canal (top 6 + "Autres"), selon le modèle/la dimension actifs. */
  sourceTrend: DailySourceTrend;
};

export type TransactionsResponse = {
  rows: AttributionRow[];
  total: number;
  page: number;
  pageSize: number;
};
