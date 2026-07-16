import { NextResponse } from "next/server";

import { getMyAccountInfo } from "@/lib/account/repository";
import { apiErrorResponse } from "@/lib/auth/errors";

export async function GET() {
  try {
    const account = await getMyAccountInfo();
    return NextResponse.json({ account });
  } catch (error) {
    return apiErrorResponse(error, "[api/account GET]", "Failed to load account");
  }
}
