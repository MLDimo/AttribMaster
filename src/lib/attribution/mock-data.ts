import type { AttributionRow, Touchpoint } from "./types";

/**
 * Projet "test mockdata" : jamais connecté à un vrai BigQuery, sert de bac à
 * sable permanent pour tester les modèles d'attribution sans données réelles.
 * Les fonctions du repository court-circuitent BigQuery pour cet ID précis.
 */
export const MOCK_PROJECT_ID = "5cbb9f60-d11d-4461-8879-24e20f871439";

const MOCK_CHANNELS: Array<{ source: string; medium: string; campaign: string | null }> = [
  { source: "google", medium: "cpc", campaign: "brand-search" },
  { source: "google", medium: "organic", campaign: null },
  { source: "facebook", medium: "paid", campaign: "retargeting-q3" },
  { source: "instagram", medium: "paid", campaign: "prospecting" },
  { source: "direct", medium: "none", campaign: null },
  { source: "newsletter", medium: "email", campaign: "weekly-digest" },
  { source: "bing", medium: "cpc", campaign: "brand-search" },
  { source: "partner-blog", medium: "referral", campaign: null },
];

const MOCK_DAYS_OF_HISTORY = 60;
const MOCK_TRANSACTION_COUNT = 180;

/** PRNG déterministe (mulberry32) : mêmes données générées à chaque appel, sans dépendre de l'état du module. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateRows(): AttributionRow[] {
  const rng = mulberry32(20260710);
  const now = Date.now();
  const rows: AttributionRow[] = [];

  for (let i = 0; i < MOCK_TRANSACTION_COUNT; i++) {
    const daysAgo = rng() * MOCK_DAYS_OF_HISTORY;
    const purchaseTime = now - daysAgo * 24 * 60 * 60 * 1000;

    const touchpointCount = 1 + Math.floor(rng() * 4); // 1 à 4 touchpoints
    const spreadDays = 1 + rng() * 9; // parcours étalé sur 1 à 10 jours avant l'achat

    const touchpoints: Touchpoint[] = [];
    for (let t = 0; t < touchpointCount; t++) {
      const channel = MOCK_CHANNELS[Math.floor(rng() * MOCK_CHANNELS.length)];
      const daysBeforePurchase = (spreadDays * (touchpointCount - t)) / touchpointCount;
      const timestamp = new Date(purchaseTime - daysBeforePurchase * 24 * 60 * 60 * 1000).toISOString();
      touchpoints.push({
        source: channel.source,
        medium: channel.medium,
        campaign: channel.campaign,
        timestamp,
        position: t,
      });
    }
    // Dernier touchpoint au plus près de l'achat (position temporelle cohérente).
    touchpoints[touchpoints.length - 1].timestamp = new Date(purchaseTime).toISOString();

    const revenue = Math.round((20 + rng() * 280) * 100) / 100;
    const purchaseDate = new Date(purchaseTime);

    rows.push({
      transaction_id: `mock-${i.toString().padStart(4, "0")}`,
      user_pseudo_id: `mock-user-${Math.floor(rng() * 90) + 1}`,
      event_date: purchaseDate.toISOString().slice(0, 10),
      event_timestamp: purchaseDate.toISOString(),
      purchase_revenue: revenue,
      currency: "EUR",
      source_path: touchpoints.map((tp) => `${tp.source}/${tp.medium}`).join(" > "),
      touchpoints,
    });
  }

  return rows.sort((a, b) => a.event_timestamp.localeCompare(b.event_timestamp));
}

let cachedRows: AttributionRow[] | null = null;

/** Jeu de transactions mock, généré une fois puis mis en cache (déterministe donc stable entre appels). */
export function getMockRows(): AttributionRow[] {
  if (!cachedRows) cachedRows = generateRows();
  return cachedRows;
}
