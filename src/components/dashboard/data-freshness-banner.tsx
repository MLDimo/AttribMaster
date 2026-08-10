"use client";

import { AlertTriangle, Clock, CreditCard, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type RefreshStatus = {
  job: { status: "pending" | "processing" | "done" | "failed"; finished_at: string | null } | null;
  lastSuccessAt: string | null;
  failureKind: "billing" | "generic" | null;
  gcpProjectId: string | null;
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

  // Facturation Google Cloud coupée : cas isolé du message d'échec générique
  // ci-dessous, qui renvoie vers la connexion BigQuery — or elle fonctionne
  // (les lectures passent), seules les écritures sont refusées. Le client est
  // le seul à pouvoir débloquer, dans SA console Google Cloud.
  if (status.job.status === "failed" && status.failureKind === "billing") {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm"
      >
        <CreditCard className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex flex-col gap-1">
          <p className="font-medium text-destructive">
            La facturation Google Cloud est désactivée sur ton projet BigQuery.
          </p>
          <p className="text-muted-foreground">
            Sans compte de facturation actif, BigQuery repasse en mode « bac à sable » et refuse d&apos;écrire
            les résultats d&apos;attribution.{" "}
            {status.lastSuccessAt
              ? `Les chiffres affichés datent d'${formatDaysAgo(status.lastSuccessAt)}.`
              : "Aucune donnée n'a encore pu être importée."}{" "}
            Réactiver la facturation suffit à tout débloquer — le palier gratuit de BigQuery continue de
            s&apos;appliquer.
          </p>
          {status.gcpProjectId && (
            <a
              href={`https://console.cloud.google.com/billing/linkedaccount?project=${encodeURIComponent(status.gcpProjectId)}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-fit items-center gap-1.5 font-medium text-destructive underline underline-offset-2"
            >
              <ExternalLink className="size-3.5 shrink-0" />
              Réactiver la facturation du projet {status.gcpProjectId}
            </a>
          )}
        </div>
      </div>
    );
  }

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
