"use client";

import { Loader2, Save, Sheet, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Project } from "@/lib/projects/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR");
}

/**
 * Configure l'export nocturne des transactions vers une Google Sheet (voir
 * lib/google-sheets/client.ts) : chaque nuit, le script de nuit remplace le
 * contenu de l'onglet "AttribMaster" de la feuille par les 90 derniers jours.
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
  const [url, setUrl] = useState(project.export_google_sheet_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = Boolean(project.export_google_sheet_url);
  const isDirty = url.trim() !== (project.export_google_sheet_url ?? "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/google-sheet-export`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
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
      setUrl("");
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
        automatiquement, les autres onglets ne sont jamais touchés). La feuille doit être partagée en
        édition avec le compte Google connecté à ce projet.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          disabled={saving}
          className="min-w-64 flex-1"
        />
        <Button size="sm" onClick={handleSave} disabled={saving || !isDirty || url.trim().length === 0}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Enregistrer
        </Button>
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
