import { NextResponse } from "next/server";

import { listMyAccounts } from "@/lib/projects/repository";
import { apiErrorResponse } from "@/lib/auth/errors";

export async function GET() {
  try {
    const accounts = await listMyAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    return apiErrorResponse(error, "[api/accounts GET]", "Failed to load accounts");
  }
}
