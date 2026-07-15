import { priceIdFor, setupFeePriceId } from "@/lib/stripe/prices";
import type { BillingInterval, SubscribablePlanId } from "@/lib/billing/plans";

export type SubscriptionLineItem = { price: string; quantity: number };

/**
 * Facturation annuelle : installation toujours offerte. Facturation
 * mensuelle : installation en option, ajoutée seulement si explicitement
 * choisie.
 */
export function buildSubscriptionLineItems(
  plan: SubscribablePlanId,
  interval: BillingInterval,
  includeSetup: boolean | undefined
): SubscriptionLineItem[] {
  const lineItems: SubscriptionLineItem[] = [{ price: priceIdFor(plan, interval), quantity: 1 }];
  if (interval === "monthly" && includeSetup) {
    lineItems.push({ price: setupFeePriceId(), quantity: 1 });
  }
  return lineItems;
}
