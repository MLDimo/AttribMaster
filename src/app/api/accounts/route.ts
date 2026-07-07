import { NextResponse } from "next/server";

import { listMyAccounts } from "@/lib/projects/repository";

export async function GET() {
  try {
    const accounts = await listMyAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("[api/accounts GET]", error);
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }
}
