"use client";

import { ExternalLink, Loader2, Sheet, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { GoogleSheetPickerButton } from "@/components/dashboard/google-sheet-picker-button";
import type { Project } from "@/lib/projects/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR");
}

/**
 * Configure l'export nocturne des transactions vers une Google Sheet (voir
 * lib/google-sheets/client.ts) : chaque nuit, le script de nuit remplace le
 * contenu de l'onglet "AttribMaster" de la feuille par les 90 derniers jours.
 *
 * La feuille se choisit via le sélecteur Google (Picker), pas en collant une
 * URL : sous le scope `drive.file`, coller une URL ne donnerait accès à
 * rien — voir le commentaire dans lib/gcp-oauth/client.ts.
 */
export function GoogleSheetExportSettings({
  projectId,
  project,
  onSaved,
}: {
  projectId: string;
  project: Project;
  onSaved: (project: Project) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = Boolean(project.export_google_sheet_url);

  async function handlePicked(url: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/google-sheet-export`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.formErrors?.[0] ?? json.error ?? "Échec de l'enregistrement.");
        return;
      }
      onSaved({
        ...project,
        export_google_sheet_url: json.url,
        export_google_sheet_last_synced_at: json.lastSyncedAt,
        export_google_sheet_last_error: json.lastError,
      });
    } catch {
      setError("Échec de l'enregistrement — réessaie dans un instant.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/google-sheet-export`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onSaved({
        ...project,
        export_google_sheet_url: null,
        export_google_sheet_last_synced_at: null,
        export_google_sheet_last_error: null,
      });
    } catch {
      setError("Échec de la désactivation — réessaie dans un instant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Chaque nuit, les transactions des 90 derniers jours sont écrites dans un onglet{" "}
        <span className="font-medium text-foreground">« AttribMaster »</span> de cette feuille (créé
        automatiquement, les autres onglets ne sont jamais touchés).
      </p>

      {configured && (
        <a
          href={project.export_google_sheet_url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Sheet className="size-3.5 shrink-0" />
          Ouvrir la feuille configurée
          <ExternalLink className="size-3 shrink-0" />
        </a>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {saving ? (
          <Button size="sm" variant="outline" disabled className="w-fit">
            <Loader2 className="size-3.5 animate-spin" />
            Enregistrement…
          </Button>
        ) : (
          <GoogleSheetPickerButton projectId={projectId} onPicked={handlePicked} />
        )}
        {configured && (
          <Button size="sm" variant="ghost" onClick={handleDisable} disabled={saving}>
            <Trash2 className="size-3.5" />
            Désactiver
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {configured && !error && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sheet className="size-3.5 shrink-0" />
          {project.export_google_sheet_last_error ? (
            <span className="text-destructive" title={project.export_google_sheet_last_error}>
              Dernière tentative en échec — survole pour le détail.
            </span>
          ) : project.export_google_sheet_last_synced_at ? (
            <span>Dernière synchro : {formatDate(project.export_google_sheet_last_synced_at)}</span>
          ) : (
            <span>Pas encore synchronisé — le prochain cron nocturne s&apos;en charge.</span>
          )}
        </p>
      )}
    </div>
  );
}
