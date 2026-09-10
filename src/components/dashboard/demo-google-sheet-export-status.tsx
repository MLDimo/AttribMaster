"use client";

import { ExternalLink, Sheet } from "lucide-react";
import { useEffect, useState } from "react";

import { MOCK_PROJECT_ID } from "@/lib/attribution/mock-data";

type Status = {
  spreadsheetUrl: string;
  spreadsheetTitle: string | null;
  rowCount: number | null;
};

/**
 * Preuve visuelle, en lecture seule, de l'export Google Sheets nocturne du
 * projet démo — voir lib/google-sheets/demo-export.ts. Affichée uniquement
 * sur "Project mockdata", pour pouvoir la montrer telle quelle lors de la
 * vérification du scope `spreadsheets` par l'équipe OAuth de Google : c'est
 * la seule preuve du scope accessible sans compte client réel connecté.
 */
export function DemoGoogleSheetExportStatus() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${MOCK_PROJECT_ID}/google-sheet-export`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: Status | null) => {
        if (!cancelled) setStatus(json);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const live = status?.spreadsheetTitle !== null && status?.spreadsheetTitle !== undefined;

  return (
    <div className="flex flex-col gap-1.5 border-t pt-4">
      <span className="text-xs font-medium text-muted-foreground">Export Google Sheets</span>
      <p className="text-xs text-muted-foreground">
        Chaque nuit, les transactions des 90 derniers jours sont écrites dans un onglet{" "}
        <span className="font-medium text-foreground">« AttribMaster »</span> de cette feuille.
      </p>
      <a
        href={status?.spreadsheetUrl ?? "#"}
        target="_blank"
        rel="noreferrer"
        className="flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Sheet className="size-3.5 shrink-0" />
        {live ? status.spreadsheetTitle : "Ouvrir la feuille"}
        <ExternalLink className="size-3 shrink-0" />
      </a>
      {status === null ? (
        <span className="text-xs text-muted-foreground">Chargement du statut…</span>
      ) : live ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-success" />
          Connecté — {status.rowCount} ligne{status.rowCount === 1 ? "" : "s"} actuellement exportée
          {status.rowCount === 1 ? "" : "s"}
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-destructive" />
          Statut indisponible pour le moment
        </span>
      )}
    </div>
  );
}
