import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { aggregateCreditsBySource } from "@/lib/attribution/models";
import { getAttributionRows } from "@/lib/attribution/repository";
import { comparisonRange, defaultRange } from "@/lib/attribution/date-range";
import type { AttributionModel } from "@/lib/attribution/types";

const querySchema = z.object({
  projectId: z.string().uuid(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  model: z
    .enum(["last_click", "linear", "time_decay", "u_shape", "markov", "shapley"])
    .default("linear"),
  comparison: z
    .enum(["previous_period", "last_week", "last_month"])
    .default("previous_period"),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { projectId } = parsed.data;
  const fallback = defaultRange();
  const from = parsed.data.from ?? fallback.from;
  const to = parsed.data.to ?? fallback.to;
  const model: AttributionModel = parsed.data.model;
  const previous = comparisonRange(from, to, parsed.data.comparison);

  try {
    const [rows, previousRows] = await Promise.all([
      getAttributionRows(projectId, { from, to }),
      getAttributionRows(projectId, previous),
    ]);

    const revenue = rows.reduce((sum, row) => sum + row.purchase_revenue, 0);
    const previousRevenue = previousRows.reduce(
      (sum, row) => sum + row.purchase_revenue,
      0
    );
    const revenueChangePct =
      previousRevenue > 0
        ? ((revenue - previousRevenue) / previousRevenue) * 100
        : null;

    return NextResponse.json({
      range: { from, to },
      comparison: previous,
      totals: {
        revenue,
        transactions: rows.length,
        previousRevenue,
        revenueChangePct,
      },
      topSources: aggregateCreditsBySource(rows, model),
    });
  } catch (error) {
    console.error("[api/overview]", error);
    return NextResponse.json(
      { error: "Failed to load overview data" },
      { status: 500 }
    );
  }
}
