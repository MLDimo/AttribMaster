import { NextRequest, NextResponse } from "next/server";

import { getDbPool } from "@/lib/db/client";
import { getProjectAsService, requireProjectAccess, requireUserId } from "@/lib/projects/repository";
import { getStripeClient } from "@/lib/stripe/client";
import { apiErrorResponse } from "@/lib/auth/errors";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  try {
    const userId = await requireUserId();
    await requireProjectAccess(projectId, userId);

    const project = await getProjectAsService(projectId);
    if (!project?.billing_account_id) {
      return NextResponse.json({ error: "Ce projet n'a pas de compte de facturation." }, { status: 400 });
    }

    const db = getDbPool();
    const { rows } = await db.query<{ stripe_customer_id: string | null }>(
      `select stripe_customer_id from billing_accounts where id = $1`,
      [project.billing_account_id]
    );
    const customerId = rows[0]?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json({ error: "Compte de facturation invalide." }, { status: 400 });
    }

    const stripe = getStripeClient();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      // Dérivé de la requête entrante, voir le commentaire équivalent dans
      // subscribe/route.ts.
      return_url: `${request.nextUrl.origin}/projects/${projectId}`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/billing-portal POST]", "Failed to open billing portal");
  }
}
