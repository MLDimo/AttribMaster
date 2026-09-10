"use client";

import { AlertTriangle, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

// Chargé une seule fois par onglet, quel que soit le nombre d'instances du
// bouton sur la page (peu probable, mais évite un doublon de <script> si
// jamais) — `gapi`/`google.picker` sont des globales posées par le script.
let gapiLoadPromise: Promise<void> | null = null;

function loadGapi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("client only"));
  if (window.gapi?.load) return Promise.resolve();
  gapiLoadPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Échec du chargement du script Google"));
    document.head.appendChild(script);
  });
  return gapiLoadPromise;
}

function loadPicker(): Promise<void> {
  return loadGapi().then(
    () =>
      new Promise((resolve, reject) => {
        if (window.google?.picker) {
          resolve();
          return;
        }
        window.gapi!.load("picker", { callback: () => resolve(), onerror: () => reject(new Error("picker")) });
      })
  );
}

/**
 * Choix d'une feuille Google Sheets via le sélecteur natif de Google (Picker),
 * seule façon d'accorder l'accès à un fichier existant sous le scope
 * `drive.file` — coller une URL ne suffit plus (voir gcp-oauth/client.ts).
 * Le développeur key est PUBLIC par nature (restreint côté Console par
 * référent HTTP, pas un secret) : NEXT_PUBLIC_GOOGLE_PICKER_API_KEY.
 */
export function GoogleSheetPickerButton({
  projectId,
  onPicked,
}: {
  projectId: string;
  onPicked: (url: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;

  if (!apiKey) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-amber-600">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        Sélecteur Google Sheets non configuré (NEXT_PUBLIC_GOOGLE_PICKER_API_KEY manquante).
      </p>
    );
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const [, tokenRes] = await Promise.all([
        loadPicker(),
        fetch(`/api/projects/${projectId}/google-sheet-export/picker-token`),
      ]);
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) {
        setError(tokenJson.error ?? "Impossible de préparer le sélecteur.");
        return;
      }

      // Garanti chargé par loadPicker() ci-dessus, et apiKey garanti défini
      // par le early return plus haut (TS ne relie pas les deux à travers la
      // fermeture de handleClick).
      const picker = window.google!.picker;
      const view = new picker.DocsView(picker.ViewId.SPREADSHEETS).setMode(picker.DocsViewMode.LIST);

      // Ce qui EST personnalisable côté Google (titre, langue, pas de volet
      // de navigation superflu vu qu'une seule vue est ajoutée) — le reste
      // (couleurs, police) ne l'est délibérément pas : Google verrouille
      // l'apparence de ce dialogue pour que l'utilisateur le reconnaisse sans
      // ambiguïté comme SA propre frontière de sécurité Google, jamais comme
      // un composant de l'app hôte qui pourrait l'imiter.
      let builder = new picker.PickerBuilder()
        .addView(view)
        .enableFeature(picker.Feature.NAV_HIDDEN)
        .setTitle("Choisir la feuille pour l'export AttribMaster")
        .setLocale("fr")
        .setOAuthToken(tokenJson.accessToken)
        .setDeveloperKey(apiKey!);
      // Sans setAppId, la sélection réussit visuellement mais Drive
      // n'enregistre jamais l'accès par fichier qu'exige `drive.file` — toute
      // requête serveur ultérieure sur ce fichier échoue en 404 (bug vécu :
      // voir le commentaire dans googleCloudProjectNumber). appId peut
      // manquer si GOOGLE_CLIENT_ID est absent côté serveur — le Picker
      // s'ouvre quand même, juste sans cette étape.
      if (tokenJson.appId) builder = builder.setAppId(tokenJson.appId);
      const instance = builder
        .setCallback((data: { action: string; docs?: { url: string }[] }) => {
          if (data.action === picker.Action.PICKED && data.docs?.[0]?.url) {
            onPicked(data.docs[0].url);
          }
        })
        .build();
      instance.setVisible(true);
    } catch {
      setError("Le sélecteur Google n'a pas pu s'ouvrir — réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button size="sm" variant="outline" onClick={handleClick} disabled={loading} className="w-fit">
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
        Choisir une feuille Google Sheets
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface PickerDocsView {
  setMode: (mode: unknown) => PickerDocsView;
}

interface PickerInstance {
  setVisible: (visible: boolean) => void;
}

interface PickerBuilderInstance {
  addView: (view: PickerDocsView) => PickerBuilderInstance;
  enableFeature: (feature: unknown) => PickerBuilderInstance;
  setAppId: (appId: string) => PickerBuilderInstance;
  setTitle: (title: string) => PickerBuilderInstance;
  setLocale: (locale: string) => PickerBuilderInstance;
  setOAuthToken: (token: string) => PickerBuilderInstance;
  setDeveloperKey: (key: string) => PickerBuilderInstance;
  setCallback: (cb: (data: { action: string; docs?: { url: string }[] }) => void) => PickerBuilderInstance;
  build: () => PickerInstance;
}

declare global {
  interface Window {
    gapi?: { load: (api: string, opts: { callback: () => void; onerror: () => void }) => void };
    google?: {
      picker: {
        DocsView: new (viewId: unknown) => PickerDocsView;
        DocsViewMode: { LIST: unknown };
        Feature: { NAV_HIDDEN: unknown };
        ViewId: { SPREADSHEETS: unknown };
        Action: { PICKED: string };
        PickerBuilder: new () => PickerBuilderInstance;
      };
    };
  }
}
