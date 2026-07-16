"use client";

import { AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type RefreshStatus = {
  job: { status: "pending" | "processing" | "done" | "failed"; finished_at: string | null } | null;
  lastSuccessAt: string | null;
};

const STALE_AFTER_HOURS = 48;

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000);
}

function formatDaysAgo(iso: string): string {
  const days = Math.floor(hoursSince(iso) / 24);
  return days <= 1 ? "hier" : `il y a ${days} jours`;
}

/**
 * Prévient l'utilisateur quand ses données ne sont plus fiables : dernière
 * mise à jour en échec (token Google révoqué, etc.) ou données plus vieilles
 * que 48h. Invisible tant que tout va bien.
 */
export function DataFreshnessBanner({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<RefreshStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/refresh`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setStatus(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Pas encore chargé, ou projet sans aucun run (ex: projet démo) : rien.
  if (!status?.job) return null;

  if (status.job.status === "failed") {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p className="font-medium text-destructive">La dernière mise à jour des données a échoué.</p>
          <p className="text-muted-foreground">
            {status.lastSuccessAt
              ? `Les chiffres affichés datent d'${formatDaysAgo(status.lastSuccessAt)}. `
              : "Aucune donnée n'a encore pu être importée. "}
            Vérifie la connexion BigQuery dans{" "}
            <Link href={`/projects/${projectId}/manage`} className="font-medium underline underline-offset-2">
              la gestion du projet
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  if (status.lastSuccessAt && hoursSince(status.lastSuccessAt) > STALE_AFTER_HOURS) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-4 py-3 text-sm"
      >
        <Clock className="mt-0.5 size-4 shrink-0 text-brand-accent" />
        <p className="text-muted-foreground">
          Dernière mise à jour réussie {formatDaysAgo(status.lastSuccessAt)} — les données récentes peuvent
          manquer. Tu peux relancer une actualisation depuis{" "}
          <Link href={`/projects/${projectId}/manage`} className="font-medium underline underline-offset-2">
            la gestion du projet
          </Link>
          .
        </p>
      </div>
    );
  }

  return null;
}
