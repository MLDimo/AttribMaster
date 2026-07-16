import { after, NextRequest, NextResponse } from "next/server";

import { getProject } from "@/lib/projects/repository";
import { isProjectConnected, isProjectSubscribed } from "@/lib/projects/types";
import { enqueueManualRefresh, getLatestJobForProject, processQueue } from "@/lib/attribution/queue";
import { apiErrorResponse } from "@/lib/auth/errors";

// Marge pour laisser processQueue() finir le job qu'on vient d'enfiler,
// déclenché après la réponse (voir after() plus bas).
export const maxDuration = 60;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found or not accessible" }, { status: 404 });
    }
    const job = await getLatestJobForProject(id);
    return NextResponse.json({ job });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/refresh GET]", "Failed to load refresh status");
  }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found or not accessible" }, { status: 404 });
    }
    if (!isProjectConnected(project) || !isProjectSubscribed(project)) {
      return NextResponse.json({ error: "Ce projet n'est pas connecté ou pas abonné." }, { status: 400 });
    }

    const existing = await getLatestJobForProject(id);
    if (existing && (existing.status === "pending" || existing.status === "processing")) {
      // Déjà en cours (run manuel précédent ou tick de cron) : pas de doublon,
      // on renvoie juste l'état actuel pour que le bouton reste verrouillé.
      return NextResponse.json({ job: existing });
    }

    const job = await enqueueManualRefresh(id);
    // Traite tout de suite (sans attendre le prochain tick de cron), mais
    // après avoir répondu au clic : le bouton ne bloque pas la navigation,
    // le front poll GET pour connaître l'avancement.
    after(() => processQueue(Date.now() + (maxDuration - 10) * 1000));

    return NextResponse.json({ job });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/refresh POST]", "Failed to start refresh");
  }
}
