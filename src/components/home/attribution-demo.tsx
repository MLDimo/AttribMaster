"use client";

import { useState } from "react";

import { AttributionChain } from "@/components/dashboard/attribution-chain";
import { AttributionChart } from "@/components/dashboard/attribution-chart";
import type { SourceCredit, Touchpoint } from "@/lib/attribution/types";

const TOTAL = 10000;

const LAST_CLICK: SourceCredit[] = [
  { source: "direct / none", revenue: 4200, share: 0.42 },
  { source: "email / newsletter", revenue: 2400, share: 0.24 },
  { source: "google / cpc", revenue: 1500, share: 0.15 },
  { source: "meta / paid social", revenue: 1200, share: 0.12 },
  { source: "organic / search", revenue: 700, share: 0.07 },
];

const SHAPLEY: SourceCredit[] = [
  { source: "google / cpc", revenue: 3100, share: 0.31 },
  { source: "meta / paid social", revenue: 2600, share: 0.26 },
  { source: "direct / none", revenue: 2000, share: 0.2 },
  { source: "email / newsletter", revenue: 1500, share: 0.15 },
  { source: "organic / search", revenue: 800, share: 0.08 },
];

// Un parcours client réaliste : découverte payante, relance, nurture, achat en direct.
const EXAMPLE_TOUCHPOINTS: Touchpoint[] = [
  { source: "google", medium: "cpc", campaign: null, timestamp: "2026-07-01T09:00:00Z", position: 0 },
  { source: "meta", medium: "paid social", campaign: null, timestamp: "2026-07-04T18:30:00Z", position: 1 },
  { source: "email", medium: "newsletter", campaign: null, timestamp: "2026-07-08T08:00:00Z", position: 2 },
  { source: "direct", medium: "none", campaign: null, timestamp: "2026-07-09T20:15:00Z", position: 3 },
];
const EXAMPLE_AMOUNT = 340;

export function AttributionDemo() {
  const [model, setModel] = useState<"last_click" | "shapley">("last_click");
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const sources = model === "last_click" ? LAST_CLICK : SHAPLEY;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-center gap-1 self-center rounded-full border bg-muted/50 p-1 text-sm">
        <button
          onClick={() => setModel("last_click")}
          className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
            model === "last_click" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Last Click
        </button>
        <button
          onClick={() => setModel("shapley")}
          className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
            model === "shapley" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Valeur de Shapley
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-3 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Exemple : un parcours d&apos;achat réel</span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {EXAMPLE_AMOUNT.toLocaleString("fr-FR")} €
          </span>
        </div>
        <AttributionChain
          touchpoints={EXAMPLE_TOUCHPOINTS}
          model={model}
          topSources={sources}
          selectedChannel={selectedChannel}
        />
        <p className="text-xs text-muted-foreground">Survole chaque source pour voir sa part de la conversion.</p>
      </div>

      <AttributionChart sources={sources} selectedChannel={selectedChannel} onSelectChannel={setSelectedChannel} />

      <p className="text-center text-sm text-muted-foreground">
        {model === "last_click"
          ? `Avec le dernier clic, "direct / none" capte 42 % de tes ${TOTAL.toLocaleString("fr-FR")} € — tes canaux payants semblent presque inutiles.`
          : `Avec Shapley, Google et Meta représentent en réalité 57 % de la conversion — c'est là qu'est vraiment ton budget qui travaille.`}
      </p>
    </div>
  );
}
