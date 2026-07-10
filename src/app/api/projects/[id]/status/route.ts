import { NextRequest, NextResponse } from "next/server";

import { getLastDataTimestamp } from "@/lib/attribution/repository";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const lastDataAt = await getLastDataTimestamp(id);
    return NextResponse.json({ lastDataAt });
  } catch {
    // Projet non connecté, dataset vide, ou erreur BigQuery : pas de donnée fraîche à afficher.
    return NextResponse.json({ lastDataAt: null });
  }
}
