import { NextRequest, NextResponse } from "next/server";

import { runNightlyAttributionForProject } from "@/lib/attribution/nightly-run";
import { enqueueBackfillForAllProjects, processQueue } from "@/lib/attribution/queue";

// Sans ça, la fonction serverless est tuée au timeout par défaut du plan
// Vercel avant d'avoir traité tous les projets (constaté en prod : un projet
// dont les données étaient pourtant dispo dans BigQuery n'était pas rattrapé
// par le run automatique). Plafonné automatiquement à la limite du plan si
// celui-ci autorise moins que 300s.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetDate = request.nextUrl.searchParams.get("date") ?? undefined;
  const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined;

  try {
    // Override manuel (backfill ciblé) : run direct, hors file d'attente.
    if (projectId) {
      const result = await runNightlyAttributionForProject(projectId, targetDate);
      return NextResponse.json(result);
    }

    // Tick quotidien normal : enfile un job par jour de la fenêtre de
    // rattrapage (3 derniers jours) par projet connecté + abonné (idempotent),
    // puis vide la file dans le budget de temps restant. L'export GA4 ->
    // BigQuery pouvant mettre jusqu'à 72h à être complet, un jour déjà traité
    // avec 0 résultat est retenté automatiquement les jours suivants. Rien
    // n'est perdu si le budget est dépassé : les jobs non traités restent
    // "pending" et seront repris au prochain appel (prochain tick de cron, ou
    // un refresh manuel sur un projet donné).
    const enqueued = await enqueueBackfillForAllProjects();
    const deadline = Date.now() + (maxDuration - 20) * 1000;
    const { processed } = await processQueue(deadline);
    return NextResponse.json({ enqueued: enqueued.length, processed });
  } catch (error) {
    console.error("[cron/nightly-attribution]", error);
    return NextResponse.json(
      { error: "Nightly attribution run failed" },
      { status: 500 }
    );
  }
}
