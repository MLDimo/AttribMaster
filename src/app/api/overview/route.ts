import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { comparisonRange, defaultRange } from "@/lib/attribution/date-range";
import { channelLabel } from "@/lib/attribution/dimension";
import { aggregateCreditsBySource } from "@/lib/attribution/models";
import { getAttributionRows } from "@/lib/attribution/repository";
import { buildDailySourceTrend, buildDailyTrend, rankPlottedChannels } from "@/lib/attribution/trend";
import type { AttributionModel } from "@/lib/attribution/types";
import { apiErrorResponse } from "@/lib/auth/errors";

const querySchema = z
  .object({
    projectId: z.string().uuid(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    model: z
      .enum(["last_click", "linear", "time_decay", "u_shape", "markov", "shapley"])
      .default("linear"),
    comparison: z
      .enum(["previous_period", "last_week", "last_month", "previous_year"])
      .default("previous_period"),
    dimension: z.enum(["source", "medium", "campaign"]).default("source"),
    channelDimension: z.enum(["source", "medium", "campaign"]).optional(),
    channelValue: z.string().trim().min(1).optional(),
  })
  .refine((data) => Boolean(data.channelDimension) === Boolean(data.channelValue), {
    message: "channelDimension and channelValue must be provided together",
  });

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { projectId, dimension } = parsed.data;
  const fallback = defaultRange();
  const from = parsed.data.from ?? fallback.from;
  const to = parsed.data.to ?? fallback.to;
  const model: AttributionModel = parsed.data.model;
  const previous = comparisonRange(from, to, parsed.data.comparison);
  const { channelDimension, channelValue } = parsed.data;

  try {
    const [rows, previousRows] = await Promise.all([
      getAttributionRows(projectId, { from, to }),
      getAttributionRows(projectId, previous),
    ]);

    // Le camembert ET le graphe de tendance gardent toujours la vue complète
    // (ce sont des sélecteurs, pas des vues filtrées) : sélectionner un canal
    // ne fait que le mettre en évidence (grisant les autres), sans jamais
    // rezoomer/rétrécir les autres courbes. Seuls KPI/tableau/export se
    // recentrent sur les transactions touchées par le canal choisi — même
    // filtre "au moins un touchpoint matche" que la liste de transactions,
    // pour que les deux racontent la même histoire. Fetch non refiltré côté
    // BigQuery : le filtrage post-fetch réutilise le cache déjà partagé par
    // la vue non filtrée, sans requête BigQuery supplémentaire.
    const matchesChannel = (row: (typeof rows)[number]) =>
      !channelDimension || !channelValue || row.touchpoints.some((tp) => channelLabel(tp, channelDimension) === channelValue);
    const scopedRows = rows.filter(matchesChannel);
    const scopedPreviousRows = previousRows.filter(matchesChannel);

    const revenue = scopedRows.reduce((sum, row) => sum + row.purchase_revenue, 0);
    // Garde-fou multi-devise : les totaux additionnent purchase_revenue sans
    // conversion. Si l'export GA4 mélange plusieurs devises, le front doit
    // prévenir que les montants agrégés ne sont pas homogènes.
    const currencies = [...new Set(rows.map((row) => row.currency).filter((c): c is string => Boolean(c)))].sort();
    const previousRevenue = scopedPreviousRows.reduce(
      (sum, row) => sum + row.purchase_revenue,
      0
    );
    const revenueChangePct =
      previousRevenue > 0
        ? ((revenue - previousRevenue) / previousRevenue) * 100
        : null;

    // Classement des canaux tracés calculé sur les lignes NON scopées (même
    // univers que le camembert) : sélectionner un canal ne doit pas redessiner
    // le menu du graphe de tendance avec une composition différente — voir
    // `buildDailySourceTrend`.
    const globalCredits = aggregateCreditsBySource(rows, model, dimension);
    const plottedChannels = rankPlottedChannels(globalCredits);

    return NextResponse.json({
      range: { from, to },
      comparison: previous,
      totals: {
        revenue,
        transactions: scopedRows.length,
        previousRevenue,
        revenueChangePct,
      },
      totalTransactionsAllChannels: rows.length,
      topSources: globalCredits,
      currencies,
      trend: buildDailyTrend(rows, from, to),
      sourceTrend: buildDailySourceTrend(rows, from, to, model, dimension, plottedChannels),
    });
  } catch (error) {
    return apiErrorResponse(error, "[api/overview]", "Failed to load overview data");
  }
}
