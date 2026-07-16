import Stripe from "stripe";

import { getStripeClient } from "./client";

/**
 * Annule immédiatement une souscription Stripe (arrêt des facturations
 * futures). Idempotent : une souscription déjà annulée ou introuvable ne
 * bloque pas l'appelant (StripeInvalidRequestError avalée) ; toute autre
 * erreur (réseau, clé invalide...) est relancée pour que l'appelant échoue
 * plutôt que de laisser une facturation orpheline continuer.
 */
export async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  try {
    await getStripeClient().subscriptions.cancel(subscriptionId);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return;
    }
    throw error;
  }
}
