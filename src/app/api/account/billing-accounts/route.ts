import { NextResponse } from "next/server";

import { listMyBillingAccountsWithProjects } from "@/lib/billing/repository";

export async function GET() {
  try {
    const accounts = await listMyBillingAccountsWithProjects();
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("[api/account/billing-accounts GET]", error);
    return NextResponse.json({ error: "Failed to load billing accounts" }, { status: 500 });
  }
}
