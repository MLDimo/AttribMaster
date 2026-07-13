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
}: {
  touchpoints: Touchpoint[];
  model: AttributionModel;
  topSources: SourceCredit[];
}) {
  const shares = computeRowSharePercents(touchpoints, model, topSources);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {touchpoints.map((tp, i) => {
        const color = colorForSource(sourceLabel(tp.source, tp.medium));
        return (
          <span key={i} className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="cursor-default rounded px-1.5 py-0.5 text-xs font-medium text-white transition-transform hover:scale-105"
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
