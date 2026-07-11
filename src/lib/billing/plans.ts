export type PlanId = "standard" | "pro" | "custom";
export type BillingInterval = "monthly" | "annual";
export type SubscribablePlanId = Exclude<PlanId, "custom">;

export type PlanInfo = {
  id: PlanId;
  label: string;
  monthlyPriceEuros: number | null;
  fromPriceEuros?: number;
  sessionLimitLabel: string;
  selfServe: boolean;
};

/**
 * Vérité "métier" des plans (prix, libellés). Doit rester en phase avec les
 * Prices créés côté Stripe par scripts/setup-stripe.mjs — pas de lien
 * programmatique entre les deux, à resynchroniser manuellement si les tarifs
 * changent.
 */
export const PLANS: PlanInfo[] = [
  {
    id: "standard",
    label: "Standard",
    monthlyPriceEuros: 49,
    sessionLimitLabel: "Jusqu'à 100 000 sessions / mois",
    selfServe: true,
  },
  {
    id: "pro",
    label: "Pro",
    monthlyPriceEuros: 99,
    sessionLimitLabel: "Jusqu'à 500 000 sessions / mois",
    selfServe: true,
  },
  {
    id: "custom",
    label: "Sur mesure",
    monthlyPriceEuros: null,
    fromPriceEuros: 250,
    sessionLimitLabel: "Volumes importants, besoins spécifiques",
    selfServe: false,
  },
];

export const SETUP_FEE_EUROS = 50;

export function planById(id: PlanId): PlanInfo {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan: ${id}`);
  return plan;
}
