import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createBillingAccount, listMyBillingAccounts } from "@/lib/billing/repository";
import { apiErrorResponse } from "@/lib/auth/errors";

export async function GET() {
  try {
    const accounts = await listMyBillingAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    return apiErrorResponse(error, "[api/billing/accounts GET]", "Failed to load billing accounts");
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
    return apiErrorResponse(error, "[api/billing/accounts POST]", "Failed to create billing account");
  }
}
