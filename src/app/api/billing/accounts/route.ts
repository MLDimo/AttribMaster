import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createBillingAccount, listMyBillingAccounts } from "@/lib/billing/repository";

export async function GET() {
  try {
    const accounts = await listMyBillingAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("[api/billing/accounts GET]", error);
    return NextResponse.json({ error: "Failed to load billing accounts" }, { status: 500 });
  }
}

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const account = await createBillingAccount(parsed.data.workspaceId, parsed.data.name);
    return NextResponse.json({ account });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authorized on this workspace") {
      return NextResponse.json({ error: "Tu n'as pas les droits sur ce workspace." }, { status: 403 });
    }
    console.error("[api/billing/accounts POST]", error);
    return NextResponse.json({ error: "Failed to create billing account" }, { status: 500 });
  }
}
