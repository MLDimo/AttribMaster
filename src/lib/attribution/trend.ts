import { channelLabel, type AttributionDimension } from "./dimension";
import { aggregateCreditsBySource, computeWeights } from "./models";
import type { AttributionModel, AttributionRow } from "./types";

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

/** Nombre max de canaux tracés individuellement — le reste rejoint "Autres" (voir la skill dataviz : 5-6 est le seuil confortable avec légende). */
const MAX_PLOTTED_CHANNELS = 6;
export const OTHER_CHANNEL_LABEL = "Autres";

export type DailySourceTrend = {
  /** Canaux tracés, triés par revenu total desc ; inclut "Autres" en dernier si des canaux ont été repliés. */
  channels: string[];
  /** Un point par jour, `total` + une clé par canal de `channels` (0 si rien ce jour-là). */
  points: Array<{ date: string; total: number } & Record<string, number>>;
};

/** Sélectionne les canaux tracés à partir d'un classement déjà trié par revenu desc (voir `aggregateCreditsBySource`). */
export function rankPlottedChannels(credits: { source: string }[]): string[] {
  const topChannels = credits.slice(0, MAX_PLOTTED_CHANNELS).map((c) => c.source);
  const hasOverflow = credits.length > MAX_PLOTTED_CHANNELS;
  return hasOverflow ? [...topChannels, OTHER_CHANNEL_LABEL] : topChannels;
}

/**
 * Revenu par jour ET par canal, selon le modèle d'attribution et la dimension
 * de regroupement actifs : pour les modèles pondérés (tout sauf Markov/
 * Shapley), c'est un calcul exact par transaction (mêmes poids que
 * `computeWeights`, imputés au jour de l'ACHAT, pas du touchpoint). Markov et
 * Shapley ne produisent qu'une importance globale par canal (portefeuille,
 * pas par transaction — voir `computeRowSharePercents`) : on applique donc la
 * part globale de chaque canal au total de CHAQUE jour, cohérent avec le
 * traitement déjà appliqué ailleurs dans l'app pour ces deux modèles.
 *
 * `plottedChannels` fixe la liste des canaux tracés (typiquement calculée sur
 * les lignes NON filtrées, comme le camembert) : quand `rows` est un
 * sous-ensemble scopé par un filtre de canal, le menu de canaux cliquables ne
 * doit pas se redessiner avec une composition différente — seules les valeurs
 * doivent refléter le scope. Si omis, le classement est recalculé depuis `rows`
 * (comportement historique, utilisé quand l'appelant n'a pas de vue non scopée).
 */
export function buildDailySourceTrend(
  rows: AttributionRow[],
  from: string,
  to: string,
  model: AttributionModel,
  dimension: AttributionDimension = "source",
  plottedChannels?: string[]
): DailySourceTrend {
  const dailyTotals = buildDailyTrend(rows, from, to);
  const globalCredits = aggregateCreditsBySource(rows, model, dimension); // déjà trié desc par revenu

  const channels = plottedChannels ?? rankPlottedChannels(globalCredits);
  const topChannelSet = new Set(channels.filter((c) => c !== OTHER_CHANNEL_LABEL));
  const hasOtherBucket = channels.includes(OTHER_CHANNEL_LABEL);
  const bucketFor = (label: string) =>
    topChannelSet.has(label) ? label : hasOtherBucket ? OTHER_CHANNEL_LABEL : label;

  const byDate = new Map(
    dailyTotals.map((d) => {
      const point = { date: d.date, total: d.revenue } as { date: string; total: number } & Record<string, number>;
      for (const label of channels) point[label] = 0;
      return [d.date, point];
    })
  );

  if (model === "markov" || model === "shapley") {
    const shareByBucket = new Map<string, number>();
    for (const credit of globalCredits) {
      const bucket = bucketFor(credit.source);
      shareByBucket.set(bucket, (shareByBucket.get(bucket) ?? 0) + credit.share);
    }
    for (const point of byDate.values()) {
      for (const [bucket, share] of shareByBucket) {
        point[bucket] = point.total * share;
      }
    }
  } else {
    for (const row of rows) {
      const point = byDate.get(row.event_date);
      if (!point) continue; // défensif : les rows sont déjà filtrées sur [from, to]
      const weights = computeWeights(row.touchpoints, model);
      row.touchpoints.forEach((tp, i) => {
        const bucket = bucketFor(channelLabel(tp, dimension));
        point[bucket] = (point[bucket] ?? 0) + row.purchase_revenue * weights[i];
      });
    }
  }

  return { channels, points: Array.from(byDate.values()) };
}
