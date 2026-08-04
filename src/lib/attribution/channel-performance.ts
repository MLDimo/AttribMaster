import { channelLabel, type AttributionDimension } from "./dimension";
import type { AttributionRow } from "./types";

/** Sessions comptées par jour et par canal — dénominateur du taux de conversion (voir sql/nightly_channel_sessions.sql). */
export type ChannelSessionCount = {
  source: string;
  medium: string;
  campaign: string | null;
  sessions: number;
};

export type ChannelPerformance = {
  channel: string;
  sessions: number;
  transactions: number;
  /** Transactions / sessions — null si aucune session comptée pour ce canal sur la période. */
  conversionRate: number | null;
  /** Revenu total (non pondéré par le modèle d'attribution) des transactions touchées, divisé par leur nombre — null si 0 transaction. */
  avgOrderValue: number | null;
};

/**
 * Performance par canal (taux de conversion + panier moyen), indépendante du
 * modèle d'attribution choisi : contrairement à `aggregateCreditsBySource`
 * (qui pondère le revenu selon le modèle actif), ces deux métriques comptent
 * chaque transaction touchée par le canal une seule fois, à sa valeur totale
 * réelle — c'est la lecture standard "panier moyen" côté marketing, pas une
 * fraction de crédit.
 */
export function computeChannelPerformance(
  rows: AttributionRow[],
  sessionCounts: ChannelSessionCount[],
  dimension: AttributionDimension = "source"
): ChannelPerformance[] {
  const sessionsByChannel = new Map<string, number>();
  for (const s of sessionCounts) {
    const key = channelLabel(s, dimension);
    sessionsByChannel.set(key, (sessionsByChannel.get(key) ?? 0) + s.sessions);
  }

  const transactionsByChannel = new Map<string, number>();
  const revenueByChannel = new Map<string, number>();
  for (const row of rows) {
    const touchedChannels = new Set(row.touchpoints.map((tp) => channelLabel(tp, dimension)));
    for (const key of touchedChannels) {
      transactionsByChannel.set(key, (transactionsByChannel.get(key) ?? 0) + 1);
      revenueByChannel.set(key, (revenueByChannel.get(key) ?? 0) + row.purchase_revenue);
    }
  }

  const allChannels = new Set([...sessionsByChannel.keys(), ...transactionsByChannel.keys()]);

  const result: ChannelPerformance[] = Array.from(allChannels, (channel) => {
    const sessions = sessionsByChannel.get(channel) ?? 0;
    const transactions = transactionsByChannel.get(channel) ?? 0;
    const revenue = revenueByChannel.get(channel) ?? 0;
    return {
      channel,
      sessions,
      transactions,
      conversionRate: sessions > 0 ? transactions / sessions : null,
      avgOrderValue: transactions > 0 ? revenue / transactions : null,
    };
  });

  result.sort((a, b) => b.sessions - a.sessions || b.transactions - a.transactions);
  return result;
}
