import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { syncProjectSubscription, updateSubscriptionStatusByStripeId } from "@/lib/billing/repository";
import type { BillingInterval, PlanId } from "@/lib/projects/types";
import { getStripeClient } from "@/lib/stripe/client";

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[api/webhooks/stripe] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    console.error("[api/webhooks/stripe] Signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { projectId, billingAccountId, plan, interval } = session.metadata ?? {};
        if (!projectId || !billingAccountId || !plan || !interval || !session.subscription) break;

        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        await syncProjectSubscription({
          projectId,
          billingAccountId,
          plan: plan as PlanId,
          interval: interval as BillingInterval,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await updateSubscriptionStatusByStripeId(subscription.id, subscription.status);
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[api/webhooks/stripe]", event.type, error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
