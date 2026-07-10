import { NextResponse } from "next/server";

import { getMyAccountInfo } from "@/lib/account/repository";

export async function GET() {
  try {
    const account = await getMyAccountInfo();
    return NextResponse.json({ account });
  } catch (error) {
    console.error("[api/account GET]", error);
    return NextResponse.json({ error: "Failed to load account" }, { status: 500 });
  }
}
