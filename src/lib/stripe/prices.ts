import type { BillingInterval, SubscribablePlanId } from "@/lib/billing/plans";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Server-only : mapping plan+intervalle -> Stripe Price ID (voir scripts/setup-stripe.mjs). */
export function priceIdFor(plan: SubscribablePlanId, interval: BillingInterval): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
  return requireEnv(key);
}

export function setupFeePriceId(): string {
  return requireEnv("STRIPE_PRICE_SETUP_FEE");
}
