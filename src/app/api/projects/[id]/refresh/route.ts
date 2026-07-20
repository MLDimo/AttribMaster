import { after, NextRequest, NextResponse } from "next/server";

import { MOCK_PROJECT_ID } from "@/lib/attribution/mock-data";
import { getProject, requireProjectAccess, requireUserId } from "@/lib/projects/repository";
import { isProjectConnected, isProjectSubscribed } from "@/lib/projects/types";
import {
  enqueueManualRefresh,
  getLatestJobForProject,
  getProjectJobHealth,
  processQueue,
} from "@/lib/attribution/queue";
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
    const { latestJob, lastSuccessAt } = await getProjectJobHealth(id);
    return NextResponse.json({ job: latestJob, lastSuccessAt });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/refresh GET]", "Failed to load refresh status");
  }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (id === MOCK_PROJECT_ID) {
      return NextResponse.json({ error: "Ce projet de démonstration est en lecture seule." }, { status: 403 });
    }
    // Déclencher un refresh manuel est une action de gestion : un collaborateur
    // en lecture seule (project_members, sans rôle owner/admin de workspace)
    // ne doit pas pouvoir la lancer — voir hasProjectManageAccess.
    const userId = await requireUserId();
    await requireProjectAccess(id, userId);
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
