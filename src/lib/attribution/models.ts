import type {
  AttributionModel,
  AttributionRow,
  SourceCredit,
  Touchpoint,
} from "./types";

const TIME_DECAY_HALF_LIFE_DAYS = 7;

/** Sous-ensemble des modèles calculables touchpoint par touchpoint (poids qui somment à 1). */
export type WeightedModel = Exclude<AttributionModel, "markov" | "shapley">;

/** Poids (somme = 1) attribués à chaque touchpoint, du premier au dernier. */
export function computeWeights(
  touchpoints: Touchpoint[],
  model: WeightedModel
): number[] {
  const n = touchpoints.length;
  if (n === 0) return [];
  if (n === 1) return [1];

  switch (model) {
    case "last_click":
      return touchpoints.map((_, i) => (i === n - 1 ? 1 : 0));

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

function aggregateWithWeights(
  rows: AttributionRow[],
  model: WeightedModel
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

// --- Chaînes de Markov (removal effect) -----------------------------------

const MARKOV_START = "(start)";
const MARKOV_CONVERSION = "(conversion)";
const MARKOV_NULL = "(null)";
const MARKOV_ITERATIONS = 200;

type MarkovGraph = Map<string, Map<string, number>>;

/** Chemins uniques (dédupliqués consécutivement) des labels de source par transaction. */
function buildChannelPaths(rows: AttributionRow[]): string[][] {
  return rows.map((row) => {
    const labels = row.touchpoints.map(sourceLabel);
    const collapsed: string[] = [];
    for (const label of labels) {
      if (collapsed[collapsed.length - 1] !== label) collapsed.push(label);
    }
    return collapsed;
  });
}

/**
 * Construit la matrice de transition (comptage) Start -> canaux -> Conversion.
 * Si `removedChannel` est fourni, tout chemin qui le traverse est redirigé vers
 * l'état absorbant "Null" à cet endroit (méthode du removal effect).
 */
function buildTransitionCounts(
  paths: string[][],
  removedChannel?: string
): MarkovGraph {
  const graph: MarkovGraph = new Map();
  function addEdge(from: string, to: string) {
    if (!graph.has(from)) graph.set(from, new Map());
    const edges = graph.get(from)!;
    edges.set(to, (edges.get(to) ?? 0) + 1);
  }

  for (const path of paths) {
    let prev = MARKOV_START;
    let absorbed = false;
    for (const channel of path) {
      if (removedChannel && channel === removedChannel) {
        addEdge(prev, MARKOV_NULL);
        absorbed = true;
        break;
      }
      addEdge(prev, channel);
      prev = channel;
    }
    if (!absorbed) addEdge(prev, MARKOV_CONVERSION);
  }
  return graph;
}

/** Probabilité d'atteindre l'état "Conversion" depuis chaque état transitoire (itération à convergence). */
function conversionProbabilities(
  graph: MarkovGraph,
  states: string[]
): Map<string, number> {
  const prob = new Map<string, number>(states.map((s) => [s, 0]));

  for (let iter = 0; iter < MARKOV_ITERATIONS; iter++) {
    const next = new Map(prob);
    for (const state of states) {
      const edges = graph.get(state);
      if (!edges) {
        next.set(state, 0);
        continue;
      }
      let total = 0;
      let weighted = 0;
      for (const [to, count] of edges) {
        total += count;
        const toProb = to === MARKOV_CONVERSION ? 1 : to === MARKOV_NULL ? 0 : (prob.get(to) ?? 0);
        weighted += count * toProb;
      }
      next.set(state, total > 0 ? weighted / total : 0);
    }
    for (const [state, value] of next) prob.set(state, value);
  }
  return prob;
}

/** Poids d'importance relative de chaque canal, dérivés du removal effect (somme = 1). */
function markovImportance(rows: AttributionRow[]): Map<string, number> {
  const paths = buildChannelPaths(rows);
  const channels = Array.from(new Set(paths.flat()));
  const importance = new Map<string, number>();
  if (channels.length === 0) return importance;

  const fullGraph = buildTransitionCounts(paths);
  const baseline = conversionProbabilities(fullGraph, [MARKOV_START, ...channels]).get(MARKOV_START) ?? 0;

  for (const channel of channels) {
    const reducedGraph = buildTransitionCounts(paths, channel);
    const reducedStates = [MARKOV_START, ...channels.filter((c) => c !== channel)];
    const reduced = conversionProbabilities(reducedGraph, reducedStates).get(MARKOV_START) ?? 0;
    importance.set(channel, Math.max(0, baseline - reduced));
  }

  const totalEffect = Array.from(importance.values()).reduce((a, b) => a + b, 0);
  if (totalEffect === 0) {
    // Aucune différence détectable (ex: un seul canal partout) : répartition égale.
    const equalShare = 1 / channels.length;
    channels.forEach((c) => importance.set(c, equalShare));
    return importance;
  }
  channels.forEach((c) => importance.set(c, (importance.get(c) ?? 0) / totalEffect));
  return importance;
}

function aggregateWithMarkov(rows: AttributionRow[]): SourceCredit[] {
  const totalRevenue = rows.reduce((sum, r) => sum + r.purchase_revenue, 0);
  const importance = markovImportance(rows);

  return Array.from(importance.entries())
    .map(([source, share]) => ({ source, revenue: totalRevenue * share, share }))
    .sort((a, b) => b.revenue - a.revenue);
}

// --- Valeur de Shapley ------------------------------------------------------

const SHAPLEY_EXACT_MAX_CHANNELS = 12;
const SHAPLEY_MONTE_CARLO_SAMPLES = 3000;

function factorial(k: number): number {
  let result = 1;
  for (let i = 2; i <= k; i++) result *= i;
  return result;
}

function countBits(mask: number): number {
  let count = 0;
  let m = mask;
  while (m) {
    count += m & 1;
    m >>= 1;
  }
  return count;
}

/** Valeur (revenu) de la coalition S : somme des transactions dont les canaux sont tous inclus dans S. */
function makeCoalitionValueFn(
  coalitionRevenue: Map<string, number>
): (subset: Set<string>) => number {
  const parsed = Array.from(coalitionRevenue.entries()).map(([key, revenue]) => ({
    members: key.split("|"),
    revenue,
  }));
  return (subset: Set<string>) => {
    let total = 0;
    for (const { members, revenue } of parsed) {
      if (members.every((m) => subset.has(m))) total += revenue;
    }
    return total;
  };
}

function shapleyExact(
  channels: string[],
  coalitionValue: (subset: Set<string>) => number
): Map<string, number> {
  const n = channels.length;
  const totalMasks = 1 << n;
  const values = new Float64Array(totalMasks);
  for (let mask = 0; mask < totalMasks; mask++) {
    const subset = new Set<string>();
    for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.add(channels[i]);
    values[mask] = coalitionValue(subset);
  }

  const nFact = factorial(n);
  const shapley = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    let phi = 0;
    const bit = 1 << i;
    for (let mask = 0; mask < totalMasks; mask++) {
      if (mask & bit) continue;
      const s = countBits(mask);
      const weight = (factorial(s) * factorial(n - s - 1)) / nFact;
      phi += weight * (values[mask | bit] - values[mask]);
    }
    shapley.set(channels[i], phi);
  }
  return shapley;
}

function shapleyMonteCarlo(
  channels: string[],
  coalitionValue: (subset: Set<string>) => number
): Map<string, number> {
  const shapley = new Map<string, number>(channels.map((c) => [c, 0]));

  for (let iter = 0; iter < SHAPLEY_MONTE_CARLO_SAMPLES; iter++) {
    const perm = [...channels];
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    const subset = new Set<string>();
    let previousValue = 0;
    for (const channel of perm) {
      subset.add(channel);
      const value = coalitionValue(subset);
      shapley.set(channel, (shapley.get(channel) ?? 0) + (value - previousValue));
      previousValue = value;
    }
  }

  for (const channel of channels) {
    shapley.set(channel, (shapley.get(channel) ?? 0) / SHAPLEY_MONTE_CARLO_SAMPLES);
  }
  return shapley;
}

function aggregateWithShapley(rows: AttributionRow[]): SourceCredit[] {
  const totalRevenue = rows.reduce((sum, r) => sum + r.purchase_revenue, 0);
  const coalitionRevenue = new Map<string, number>();
  const channelsSet = new Set<string>();

  for (const row of rows) {
    const uniqueChannels = Array.from(new Set(row.touchpoints.map(sourceLabel)));
    uniqueChannels.forEach((c) => channelsSet.add(c));
    const key = [...uniqueChannels].sort().join("|");
    coalitionRevenue.set(key, (coalitionRevenue.get(key) ?? 0) + row.purchase_revenue);
  }

  const channels = Array.from(channelsSet);
  if (channels.length === 0) return [];

  const coalitionValue = makeCoalitionValueFn(coalitionRevenue);
  const shapley =
    channels.length <= SHAPLEY_EXACT_MAX_CHANNELS
      ? shapleyExact(channels, coalitionValue)
      : shapleyMonteCarlo(channels, coalitionValue);

  const totalShapley = Array.from(shapley.values()).reduce((a, b) => a + Math.max(0, b), 0);
  if (totalShapley === 0) return [];

  return Array.from(shapley.entries())
    .map(([source, value]) => {
      const share = Math.max(0, value) / totalShapley;
      return { source, revenue: totalRevenue * share, share };
    })
    .filter((credit) => credit.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
}

// --- Point d'entrée ---------------------------------------------------------

/** Agrège le revenu par source pour un modèle d'attribution donné. */
export function aggregateCreditsBySource(
  rows: AttributionRow[],
  model: AttributionModel
): SourceCredit[] {
  if (rows.length === 0) return [];
  if (model === "markov") return aggregateWithMarkov(rows);
  if (model === "shapley") return aggregateWithShapley(rows);
  return aggregateWithWeights(rows, model);
}

/**
 * Part (%) de CETTE transaction attribuée à chaque touchpoint, pour affichage
 * (ex: survol de la chaîne d'attribution). Pour les modèles pondérés
 * (last_click/linear/u_shape/time_decay), c'est exact (computeWeights).
 * Markov/Shapley ne produisent qu'une importance globale par canal (pas de
 * poids par transaction) : on redistribue cette importance (topSources, déjà
 * calculée pour la période/modèle courants) entre les touchpoints présents
 * dans cette transaction, renormalisée à 100 %.
 */
export function computeRowSharePercents(
  touchpoints: Touchpoint[],
  model: AttributionModel,
  topSources: SourceCredit[] = []
): number[] {
  const n = touchpoints.length;
  if (n === 0) return [];

  if (model !== "markov" && model !== "shapley") {
    return computeWeights(touchpoints, model).map((w) => w * 100);
  }

  const shareByLabel = new Map(topSources.map((s) => [s.source, s.share]));
  const rawShares = touchpoints.map((tp) => shareByLabel.get(sourceLabel(tp)) ?? 0);
  const total = rawShares.reduce((sum, s) => sum + s, 0);
  if (total === 0) {
    const equalShare = 100 / n;
    return touchpoints.map(() => equalShare);
  }
  return rawShares.map((s) => (s / total) * 100);
}
