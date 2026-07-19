import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAttributionRows } from "@/lib/attribution/repository";
import { defaultRange } from "@/lib/attribution/date-range";
import { apiErrorResponse } from "@/lib/auth/errors";

const querySchema = z.object({
  projectId: z.string().uuid(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  search: z.string().trim().min(1).optional(),
});

/** Échappement CSV : guillemets doublés, champ systématiquement quoté. */
function csvField(value: string | number | null): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const fallback = defaultRange();
  const { projectId, from = fallback.from, to = fallback.to, search } = parsed.data;

  try {
    let rows = await getAttributionRows(projectId, { from, to });
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((row) => row.transaction_id.toLowerCase().includes(needle));
    }
    rows = [...rows].sort((a, b) => (a.event_timestamp < b.event_timestamp ? 1 : -1));

    // Séparateur ";" + BOM UTF-8 : c'est ce qu'Excel en locale française
    // ouvre correctement sans assistant d'import.
    const header = ["transaction_id", "date", "horodatage", "revenu", "devise", "parcours", "nb_touchpoints"];
    const lines = [
      header.join(";"),
      ...rows.map((row) =>
        [
          csvField(row.transaction_id),
          csvField(row.event_date),
          csvField(row.event_timestamp),
          csvField(row.purchase_revenue),
          csvField(row.currency),
          csvField(row.source_path),
          csvField(row.touchpoints.length),
        ].join(";")
      ),
    ];
    const csv = "\uFEFF" + lines.join("\r\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="transactions-${from}-${to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "[api/transactions/export]", "Failed to export transactions");
  }
}
