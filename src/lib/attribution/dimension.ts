import type { Touchpoint } from "./types";

/**
 * Dimension de regroupement pour le camembert/tableau : "source" (comportement
 * historique, source+support combinés, ex: "google / cpc"), "medium" (support
 * seul, ex: "cpc" — regroupe payant/organique tous canaux confondus), ou
 * "campaign" (campagne UTM seule).
 */
export type AttributionDimension = "source" | "medium" | "campaign";

export const NO_CAMPAIGN_LABEL = "(sans campagne)";

/** Libellé d'un touchpoint selon la dimension active — clé d'agrégation des modèles. */
export function channelLabel(touchpoint: Touchpoint, dimension: AttributionDimension): string {
  if (dimension === "medium") return touchpoint.medium;
  if (dimension === "campaign") return touchpoint.campaign?.trim() || NO_CAMPAIGN_LABEL;
  return `${touchpoint.source} / ${touchpoint.medium}`;
}
