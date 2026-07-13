"use client";

import { useState } from "react";

import { AttributionChart } from "@/components/dashboard/attribution-chart";
import type { SourceCredit } from "@/lib/attribution/types";

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

export function AttributionDemo() {
  const [model, setModel] = useState<"last_click" | "shapley">("last_click");
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

      <AttributionChart sources={sources} />

      <p className="text-center text-sm text-muted-foreground">
        {model === "last_click"
          ? `Avec le dernier clic, "direct / none" capte 42 % de tes ${TOTAL.toLocaleString("fr-FR")} € — tes canaux payants semblent presque inutiles.`
          : `Avec Shapley, Google et Meta représentent en réalité 57 % de la conversion — c'est là qu'est vraiment ton budget qui travaille.`}
      </p>
    </div>
  );
}
