"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { AnimatedNumber } from "@/components/effects/animated-number";
import { StaggerContainer, StaggerItem } from "@/components/effects/motion";
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

export function AttributionChart({
  sources,
  selectedSource,
  onSelectSource,
}: {
  sources: SourceCredit[];
  selectedSource?: string | null;
  onSelectSource?: (source: string | null) => void;
}) {
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  if (sources.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        Aucune donnée pour cette période.
      </div>
    );
  }

  const data = sources.map((s) => ({ name: s.source, value: s.revenue, share: s.share }));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const hovered = data.find((d) => d.name === hoveredName) ?? null;

  function toggleSource(name: string) {
    onSelectSource?.(selectedSource === name ? null : name);
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center" data-testid="attribution-chart">
      <motion.div
        initial={{ opacity: 0, scale: 0.82, rotate: -12 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative h-64 w-full shrink-0 sm:w-64"
      >
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
                <Cell
                  key={entry.name}
                  fill={colorForSource(entry.name)}
                  fillOpacity={!selectedSource || selectedSource === entry.name ? 1 : 0.2}
                  cursor="pointer"
                  style={{ outline: "none" }}
                  onClick={() => toggleSource(entry.name)}
                  onMouseEnter={() => setHoveredName(entry.name)}
                  onMouseLeave={() => setHoveredName(null)}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
        >
          {/* Toujours monté (visibilité togglée en CSS) pour que le compteur ne se
              relance pas depuis 0 à chaque survol : seul le montage initial doit animer. */}
          <div className={`flex flex-col items-center ${hovered ? "invisible" : "visible"}`}>
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="font-mono text-lg font-semibold tabular-nums">
              <AnimatedNumber value={total} format={formatCurrency} />
            </span>
          </div>
          {hovered && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <span className="flex max-w-full items-center gap-1.5 truncate text-xs font-medium">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colorForSource(hovered.name) }}
                />
                <span className="truncate">{hovered.name}</span>
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums">
                {formatCurrency(hovered.value)}
              </span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {(hovered.share * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </motion.div>
      </motion.div>

      <StaggerContainer className="flex w-full flex-col gap-2">
        {data.map((entry) => {
          const dimmed = Boolean(selectedSource) && selectedSource !== entry.name;
          return (
            <StaggerItem key={entry.name}>
              <button
                type="button"
                onClick={() => toggleSource(entry.name)}
                onMouseEnter={() => setHoveredName(entry.name)}
                onMouseLeave={() => setHoveredName(null)}
                className={`flex w-full items-center gap-3 rounded-md px-1.5 py-1 text-left text-sm transition-opacity hover:opacity-100 ${
                  dimmed ? "opacity-40" : "opacity-100"
                }`}
              >
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
              </button>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </div>
  );
}
