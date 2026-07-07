"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { colorForSource } from "@/lib/attribution/colors";
import type { SourceCredit } from "@/lib/attribution/types";

const RADIAN = Math.PI / 180;
// Below this share, the segment is too thin to hold a legible label.
const MIN_LABEL_SHARE = 0.05;

type SliceLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
};

function renderSliceLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: SliceLabelProps) {
  if (!percent || percent < MIN_LABEL_SHARE) return null;
  if (cx === undefined || cy === undefined || midAngle === undefined) return null;
  if (innerRadius === undefined || outerRadius === undefined) return null;
  const radius = innerRadius + (outerRadius - innerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {Math.round(percent * 100)}%
    </text>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function AttributionChart({ sources }: { sources: SourceCredit[] }) {
  if (sources.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        Aucune donnée pour cette période.
      </div>
    );
  }

  const data = sources.map((s) => ({ name: s.source, value: s.revenue, share: s.share }));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative h-64 w-full shrink-0 sm:w-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={72}
              outerRadius={104}
              paddingAngle={2}
              strokeWidth={0}
              label={renderSliceLabel}
              labelLine={false}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={colorForSource(entry.name)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, item) => [
                `${formatCurrency(Number(value))} (${(((item.payload as { share: number }).share) * 100).toFixed(1)}%)`,
                (item.payload as { name: string }).name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-2">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center gap-3 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorForSource(entry.name) }}
            />
            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {(entry.share * 100).toFixed(1)}%
            </span>
            <span className="font-mono w-20 text-right tabular-nums">
              {formatCurrency(entry.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
