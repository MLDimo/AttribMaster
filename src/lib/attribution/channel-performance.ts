import { channelLabel, type AttributionDimension } from "./dimension";
import type { AttributionRow } from "./types";

/** Sessions comptées par jour et par canal — dénominateur du taux de conversion (voir sql/nightly_channel_sessions.sql). */
export type ChannelSessionCount = {
  source: string;
  medium: string;
  campaign: string | null;
  sessions: number;
};

/** Colonnes de ventilation additionnelles, au-delà de la dimension principale ("Regrouper par") — voir `computeChannelPerformance`. */
export type ChannelPerformanceBreakdown = "medium" | "campaign";

export type ChannelPerformance = {
  channel: string;
  /** Présent seulement si "medium" fait partie de `extraColumns`. */
  medium?: string;
  /** Présent seulement si "campaign" fait partie de `extraColumns`. */
  campaign?: string;
  sessions: number;
  transactions: number;
  /** Transactions / sessions — null si aucune session comptée pour ce canal sur la période. */
  conversionRate: number | null;
  /** Revenu total (non pondéré par le modèle d'attribution) des transactions touchées, divisé par leur nombre — null si 0 transaction. */
  avgOrderValue: number | null;
};

type KeyParts = { channel: string; medium?: string; campaign?: string };

function keyPartsFor(
  tp: { source: string; medium: string; campaign: string | null },
  dimension: AttributionDimension,
  extraColumns: ChannelPerformanceBreakdown[]
): KeyParts {
  const parts: KeyParts = { channel: channelLabel(tp, dimension) };
  if (extraColumns.includes("medium")) parts.medium = channelLabel(tp, "medium");
  if (extraColumns.includes("campaign")) parts.campaign = channelLabel(tp, "campaign");
  return parts;
}

// Séparateur de contrôle U+0001 (jamais présent dans un libellé réel) : sans lui,
// {channel:"a",medium:"bc"} et {channel:"ab",medium:"c"} produiraient la même clé.
const KEY_SEPARATOR = "\u0001";
function keyOf(parts: KeyParts): string {
  return [parts.channel, parts.medium ?? "", parts.campaign ?? ""].join(KEY_SEPARATOR);
}

/**
 * Performance par canal (taux de conversion + panier moyen), indépendante du
 * modèle d'attribution choisi : contrairement à `aggregateCreditsBySource`
 * (qui pondère le revenu selon le modèle actif), ces deux métriques comptent
 * chaque transaction touchée par le canal une seule fois, à sa valeur totale
 * réelle — c'est la lecture standard "panier moyen" côté marketing, pas une
 * fraction de crédit.
 *
 * `extraColumns` ventile chaque ligne plus finement (une ligne par
 * combinaison canal × valeur(s) ajoutée(s), comme une dimension secondaire
 * GA4/Google Ads) plutôt que d'ajouter une colonne indicative sur les lignes
 * existantes — demandé explicitement pour avoir une ventilation exacte, pas
 * approximative.
 */
export function computeChannelPerformance(
  rows: AttributionRow[],
  sessionCounts: ChannelSessionCount[],
  dimension: AttributionDimension = "source",
  extraColumns: ChannelPerformanceBreakdown[] = []
): ChannelPerformance[] {
  const sessionsByKey = new Map<string, { parts: KeyParts; sessions: number }>();
  for (const s of sessionCounts) {
    const parts = keyPartsFor(s, dimension, extraColumns);
    const key = keyOf(parts);
    const existing = sessionsByKey.get(key);
    if (existing) existing.sessions += s.sessions;
    else sessionsByKey.set(key, { parts, sessions: s.sessions });
  }

  const transactionsByKey = new Map<string, { parts: KeyParts; transactions: number }>();
  const revenueByKey = new Map<string, number>();
  for (const row of rows) {
    const touchedKeys = new Map<string, KeyParts>();
    for (const tp of row.touchpoints) {
      const parts = keyPartsFor(tp, dimension, extraColumns);
      touchedKeys.set(keyOf(parts), parts);
    }
    for (const [key, parts] of touchedKeys) {
      const existing = transactionsByKey.get(key);
      if (existing) existing.transactions += 1;
      else transactionsByKey.set(key, { parts, transactions: 1 });
      revenueByKey.set(key, (revenueByKey.get(key) ?? 0) + row.purchase_revenue);
    }
  }

  const allKeys = new Set([...sessionsByKey.keys(), ...transactionsByKey.keys()]);

  const result: ChannelPerformance[] = Array.from(allKeys, (key) => {
    const parts = sessionsByKey.get(key)?.parts ?? transactionsByKey.get(key)!.parts;
    const sessions = sessionsByKey.get(key)?.sessions ?? 0;
    const transactions = transactionsByKey.get(key)?.transactions ?? 0;
    const revenue = revenueByKey.get(key) ?? 0;
    return {
      ...parts,
      sessions,
      transactions,
      conversionRate: sessions > 0 ? transactions / sessions : null,
      avgOrderValue: transactions > 0 ? revenue / transactions : null,
    };
  });

  result.sort((a, b) => b.sessions - a.sessions || b.transactions - a.transactions);
  return result;
}
