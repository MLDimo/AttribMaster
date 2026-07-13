"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { NightlyJob } from "@/lib/attribution/queue";

const POLL_MS = 3000;

/** Bouton de rafraîchissement manuel : lance un run + poll son état jusqu'à la fin, sans bloquer la navigation. */
export function RefreshDataButton({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [job, setJob] = useState<NightlyJob | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/refresh`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { job: NightlyJob | null } | null) => {
        if (cancelled) return;
        setJob(json?.job ?? null);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const running = job?.status === "pending" || job?.status === "processing";

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      fetch(`/api/projects/${projectId}/refresh`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json: { job: NightlyJob | null } | null) => {
          const nextJob = json?.job ?? null;
          setJob(nextJob);
          if (nextJob && nextJob.status !== "pending" && nextJob.status !== "processing") {
            onDone();
          }
        });
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [running, projectId, onDone]);

  async function handleClick() {
    const res = await fetch(`/api/projects/${projectId}/refresh`, { method: "POST" });
    const json = await res.json();
    if (res.ok) setJob(json.job);
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <Button variant="outline" size="sm" onClick={handleClick} disabled={!loaded || running}>
        {running ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        Actualiser
      </Button>
      {running && <span className="text-muted-foreground">Mise à jour en cours…</span>}
      {job?.status === "done" && (
        <span className="text-success">
          Mis à jour ({job.rows_inserted ?? 0} transaction{(job.rows_inserted ?? 0) > 1 ? "s" : ""})
        </span>
      )}
      {job?.status === "failed" && (
        <span className="text-destructive" title={job.error ?? undefined}>
          Échec de la mise à jour
        </span>
      )}
    </div>
  );
}
