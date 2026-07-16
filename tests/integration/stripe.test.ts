import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST as webhookPost } from "@/app/api/webhooks/stripe/route";
import { getDbPool } from "@/lib/db/client";
import { cancelStripeSubscription } from "@/lib/stripe/cancel-subscription";
import { buildSubscriptionLineItems } from "@/lib/stripe/checkout";
import { getStripeClient } from "@/lib/stripe/client";
import { priceIdFor, setupFeePriceId } from "@/lib/stripe/prices";

const stripe = getStripeClient();

describe("Stripe price catalog", () => {
  it("every configured price id resolves to a real, active Stripe Price", async () => {
    const ids = [
      priceIdFor("standard", "monthly"),
      priceIdFor("standard", "annual"),
      priceIdFor("pro", "monthly"),
      priceIdFor("pro", "annual"),
      setupFeePriceId(),
    ];
    for (const id of ids) {
      const price = await stripe.prices.retrieve(id);
      expect(price.active, `price ${id} is not active`).toBe(true);
    }
  });
});

describe("Checkout session creation (real Stripe test-mode API call)", () => {
  let customerId: string;

  beforeAll(async () => {
    const customer = await stripe.customers.create({ name: "CI Test Customer" });
    customerId = customer.id;
  });

  afterAll(async () => {
    await stripe.customers.del(customerId);
  });

  it("creates a subscription checkout session with the correct total and a promo code field", async () => {
    const lineItems = buildSubscriptionLineItems("standard", "monthly", true);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      allow_promotion_codes: true,
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
    });

    expect(session.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(session.mode).toBe("subscription");

    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items"],
    });
    expect(fullSession.line_items?.data.length).toBe(2); // plan + setup fee

    await stripe.checkout.sessions.expire(session.id);
  });
});

describe("POST /api/webhooks/stripe", () => {
  it("rejects a request with an invalid signature", async () => {
    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=invalid" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await webhookPost(req);
    expect(res.status).toBe(400);
  });

  it("rejects a request with no signature header at all", async () => {
    const req = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    const res = await webhookPost(req);
    expect(res.status).toBe(400);
  });

  describe("checkout.session.completed / customer.subscription.updated (signed events)", () => {
    let projectId: string;
    let billingAccountId: string;
    let workspaceId: string;
    let subscriptionId: string;
    let customerId: string;

    beforeAll(async () => {
      const pool = getDbPool();

      const customer = await stripe.customers.create({ name: "CI Webhook Test Customer" });
      customerId = customer.id;

      const { rows: wsRows } = await pool.query(
        `insert into workspaces (name) values ('CI Stripe Test Workspace') returning id`
      );
      workspaceId = wsRows[0].id;

      const { rows: baRows } = await pool.query(
        `insert into billing_accounts (workspace_id, name, stripe_customer_id)
         values ($1, 'CI Stripe Test Billing Account', $2) returning id`,
        [workspaceId, customerId]
      );
      billingAccountId = baRows[0].id;

      const { rows: projRows } = await pool.query(
        `insert into projects (name, bigquery_dataset) values ('CI Stripe Test Project', 'attribution') returning id`
      );
      projectId = projRows[0].id;

      const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: customerId });
      await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } });
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceIdFor("standard", "monthly") }],
      });
      subscriptionId = subscription.id;
    });

    afterAll(async () => {
      await stripe.subscriptions.cancel(subscriptionId).catch(() => {});
      await stripe.customers.del(customerId).catch(() => {});
      const pool = getDbPool();
      await pool.query(`delete from projects where id = $1`, [projectId]);
      await pool.query(`delete from billing_accounts where id = $1`, [billingAccountId]);
      await pool.query(`delete from workspaces where id = $1`, [workspaceId]);
    });

    async function postSignedEvent(eventPayload: object) {
      const payload = JSON.stringify(eventPayload);
      const header = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: process.env.STRIPE_WEBHOOK_SECRET!,
      });
      const req = new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": header },
        body: payload,
      });
      return webhookPost(req);
    }

    it("activates the project subscription on checkout.session.completed", async () => {
      const res = await postSignedEvent({
        id: "evt_ci_test_" + Date.now(),
        object: "event",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_ci_simulated",
            object: "checkout.session",
            customer: customerId,
            subscription: subscriptionId,
            metadata: { projectId, billingAccountId, plan: "standard", interval: "monthly" },
          },
        },
      });
      expect(res.status).toBe(200);

      const pool = getDbPool();
      const { rows } = await pool.query(
        `select plan, billing_interval, subscription_status, stripe_subscription_id from projects where id = $1`,
        [projectId]
      );
      expect(rows[0].plan).toBe("standard");
      expect(rows[0].billing_interval).toBe("monthly");
      expect(rows[0].subscription_status).toBe("active");
      expect(rows[0].stripe_subscription_id).toBe(subscriptionId);
    });

    it("updates only the status on customer.subscription.updated", async () => {
      const res = await postSignedEvent({
        id: "evt_ci_test_" + Date.now(),
        object: "event",
        type: "customer.subscription.updated",
        data: { object: { id: subscriptionId, object: "subscription", status: "past_due" } },
      });
      expect(res.status).toBe(200);

      const pool = getDbPool();
      const { rows } = await pool.query(`select subscription_status from projects where id = $1`, [projectId]);
      expect(rows[0].subscription_status).toBe("past_due");
    });
  });
});

describe("cancelStripeSubscription (used by deleteProject)", () => {
  let customerId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    const customer = await stripe.customers.create({ email: "ci-cancel-test@attribmaster.com" });
    customerId = customer.id;
    const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: customerId });
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } });
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceIdFor("standard", "monthly") }],
    });
    subscriptionId = subscription.id;
  });

  afterAll(async () => {
    await stripe.subscriptions.cancel(subscriptionId).catch(() => {});
    await stripe.customers.del(customerId).catch(() => {});
  });

  it("actually stops the billing (status becomes canceled)", async () => {
    await cancelStripeSubscription(subscriptionId);
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    expect(subscription.status).toBe("canceled");
  });

  it("is idempotent: cancelling an already-canceled subscription does not throw", async () => {
    await expect(cancelStripeSubscription(subscriptionId)).resolves.toBeUndefined();
  });

  it("swallows an unknown subscription id (project deletion must not be blocked)", async () => {
    await expect(cancelStripeSubscription("sub_does_not_exist_ci")).resolves.toBeUndefined();
  });
});
