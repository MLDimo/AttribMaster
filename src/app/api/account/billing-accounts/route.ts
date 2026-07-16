import { NextResponse } from "next/server";

import { listMyBillingAccountsWithProjects } from "@/lib/billing/repository";
import { apiErrorResponse } from "@/lib/auth/errors";

export async function GET() {
  try {
    const accounts = await listMyBillingAccountsWithProjects();
    return NextResponse.json({ accounts });
  } catch (error) {
    return apiErrorResponse(error, "[api/account/billing-accounts GET]", "Failed to load billing accounts");
  }
}
