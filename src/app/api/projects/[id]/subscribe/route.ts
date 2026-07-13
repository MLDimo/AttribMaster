import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prepareSubscription } from "@/lib/billing/repository";
import { getStripeClient } from "@/lib/stripe/client";
import { priceIdFor, setupFeePriceId } from "@/lib/stripe/prices";

const bodySchema = z
  .object({
    plan: z.enum(["standard", "pro"]),
    interval: z.enum(["monthly", "annual"]),
    includeSetup: z.boolean().optional(),
    billingAccountId: z.string().uuid().optional(),
    newBillingAccountName: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.billingAccountId || v.newBillingAccountName, {
    message: "billingAccountId or newBillingAccountName is required",
  });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { plan, interval, includeSetup, billingAccountId, newBillingAccountName } = parsed.data;

  try {
    const { billingAccount } = await prepareSubscription(projectId, {
      plan,
      interval,
      billingAccountId,
      newBillingAccountName,
    });
    if (!billingAccount.stripe_customer_id) {
      return NextResponse.json({ error: "Billing account has no Stripe customer" }, { status: 500 });
    }

    // Dérivé de la requête entrante (pas d'une variable d'env statique) pour
    // rester correct quel que soit le domaine/alias utilisé pour y accéder —
    // sinon le cookie de session ne correspond pas au retour de Stripe et
    // l'utilisateur atterrit sur /login au lieu de son projet.
    const appUrl = request.nextUrl.origin;
    const stripe = getStripeClient();

    const lineItems = [{ price: priceIdFor(plan, interval), quantity: 1 }];
    // Facturation annuelle : installation toujours offerte. Facturation mensuelle :
    // installation en option, ajoutée seulement si explicitement choisie.
    if (interval === "monthly" && includeSetup) {
      lineItems.push({ price: setupFeePriceId(), quantity: 1 });
    }

    const metadata = { projectId, billingAccountId: billingAccount.id, plan, interval };
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: billingAccount.stripe_customer_id,
      line_items: lineItems,
      allow_promotion_codes: true,
      metadata,
      subscription_data: { metadata },
      success_url: `${appUrl}/projects/${projectId}?subscribed=1`,
      cancel_url: `${appUrl}/projects/${projectId}?subscribe_canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authorized on this project") {
      return NextResponse.json({ error: "Tu n'as pas les droits pour gérer ce projet." }, { status: 403 });
    }
    console.error("[api/projects/[id]/subscribe POST]", error);
    return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
  }
}
