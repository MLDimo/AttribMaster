// One-off setup script: creates the Stripe Products/Prices for the Standard
// and Pro plans (monthly + annual) plus the one-time setup fee, and a
// webhook endpoint pointed at the deployed app. Idempotent via lookup_key.
//
// Usage: node --env-file=.env scripts/setup-stripe.mjs
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set");
if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not set");

const stripe = new Stripe(secretKey);

async function upsertProduct(name, description) {
  const { data } = await stripe.products.list({ limit: 100, active: true });
  const existing = data.find((p) => p.name === name);
  if (existing) return existing;
  return stripe.products.create({ name, description });
}

async function upsertPrice(lookupKey, params) {
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stripe.prices.create({ ...params, lookup_key: lookupKey });
}

const standardProduct = await upsertProduct(
  "AttribMaster Standard",
  "Jusqu'à 100 000 sessions/mois"
);
const proProduct = await upsertProduct("AttribMaster Pro", "Jusqu'à 500 000 sessions/mois");
const setupFeeProduct = await upsertProduct(
  "Frais d'installation",
  "Frais uniques, offerts en cas d'abonnement annuel"
);

const standardMonthly = await upsertPrice("standard_monthly", {
  product: standardProduct.id,
  currency: "eur",
  unit_amount: 4900,
  recurring: { interval: "month" },
});
const standardAnnual = await upsertPrice("standard_annual", {
  product: standardProduct.id,
  currency: "eur",
  unit_amount: 4900 * 12,
  recurring: { interval: "year" },
});
const proMonthly = await upsertPrice("pro_monthly", {
  product: proProduct.id,
  currency: "eur",
  unit_amount: 9900,
  recurring: { interval: "month" },
});
const proAnnual = await upsertPrice("pro_annual", {
  product: proProduct.id,
  currency: "eur",
  unit_amount: 9900 * 12,
  recurring: { interval: "year" },
});
const setupFee = await upsertPrice("setup_fee", {
  product: setupFeeProduct.id,
  currency: "eur",
  unit_amount: 5000,
});

const webhookUrl = `${appUrl}/api/webhooks/stripe`;
const existingWebhooks = await stripe.webhookEndpoints.list({ limit: 100 });
let webhook = existingWebhooks.data.find((w) => w.url === webhookUrl);
let webhookSecret = null;
if (!webhook) {
  webhook = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: [
      "checkout.session.completed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ],
  });
  webhookSecret = webhook.secret;
}

console.log("\n--- Ajoute ces variables d'environnement ---\n");
console.log(`STRIPE_PRICE_STANDARD_MONTHLY=${standardMonthly.id}`);
console.log(`STRIPE_PRICE_STANDARD_ANNUAL=${standardAnnual.id}`);
console.log(`STRIPE_PRICE_PRO_MONTHLY=${proMonthly.id}`);
console.log(`STRIPE_PRICE_PRO_ANNUAL=${proAnnual.id}`);
console.log(`STRIPE_PRICE_SETUP_FEE=${setupFee.id}`);
if (webhookSecret) {
  console.log(`STRIPE_WEBHOOK_SECRET=${webhookSecret}`);
} else {
  console.log(
    `# Webhook endpoint already existed (${webhook.id}) — secret not re-shown by Stripe, reuse the one already stored.`
  );
}
