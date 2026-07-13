"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { colorForSource, sourceLabel } from "@/lib/attribution/colors";
import { computeRowSharePercents } from "@/lib/attribution/models";
import type { AttributionModel, SourceCredit, Touchpoint } from "@/lib/attribution/types";

function formatPercent(value: number): string {
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}%`;
}

/** Chaîne de touchpoints colorée, avec le % de crédit (selon le modèle) au survol de chaque badge. */
export function AttributionChain({
  touchpoints,
  model,
  topSources,
  selectedSource,
}: {
  touchpoints: Touchpoint[];
  model: AttributionModel;
  topSources: SourceCredit[];
  selectedSource?: string | null;
}) {
  const shares = computeRowSharePercents(touchpoints, model, topSources);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {touchpoints.map((tp, i) => {
        const label = sourceLabel(tp.source, tp.medium);
        const color = colorForSource(label);
        const dimmed = Boolean(selectedSource) && selectedSource !== label;
        return (
          <span key={i} className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`cursor-default rounded px-1.5 py-0.5 text-xs font-medium text-white transition-all hover:scale-105 ${
                    dimmed ? "opacity-30" : "opacity-100"
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {tp.source} / {tp.medium}
                </span>
              </TooltipTrigger>
              <TooltipContent
                className="border-none font-semibold tabular-nums text-white"
                style={{ backgroundColor: color }}
              >
                {formatPercent(shares[i])}
              </TooltipContent>
            </Tooltip>
            {i < touchpoints.length - 1 && <span className="text-muted-foreground">→</span>}
          </span>
        );
      })}
    </div>
  );
}
