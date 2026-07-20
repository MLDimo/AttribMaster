"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DailyTrendPoint } from "@/lib/attribution/trend";

function makeCurrencyFormatter(currencies: string[]) {
  const currency = currencies.length === 1 ? currencies[0] : "EUR";
  const formatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  return (value: number) => formatter.format(value);
}

function formatDayTick(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatDayFull(dateStr: string): string {
  // Seule l'initiale (le jour) prend une majuscule en français — "capitalize"
  // en CSS mettrait aussi une majuscule au mois ("17 Juillet").
  const formatted = new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function CustomTooltip({
  active,
  payload,
  formatCurrency,
}: {
  active?: boolean;
  payload?: { payload: DailyTrendPoint }[];
  formatCurrency: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 text-xs text-muted-foreground">{formatDayFull(point.date)}</p>
      <div className="flex items-center gap-2">
        <span className="h-0.5 w-3 shrink-0 rounded-full bg-brand-accent" />
        <span className="font-mono font-semibold tabular-nums">{formatCurrency(point.revenue)}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {point.transactions} transaction{point.transactions > 1 ? "s" : ""}
      </p>
    </div>
  );
}

/** Point terminal marqué (le reste de la série n'est pas labellisé un par un). */
function EndDot({ cx, cy, index, lastIndex }: { cx?: number; cy?: number; index?: number; lastIndex: number }) {
  if (index !== lastIndex || cx === undefined || cy === undefined) return null;
  return <circle cx={cx} cy={cy} r={4} fill="var(--brand-accent)" stroke="var(--card)" strokeWidth={2} />;
}

export function RevenueTrendChart({
  data,
  currencies = ["EUR"],
}: {
  data: DailyTrendPoint[];
  currencies?: string[];
}) {
  const formatCurrency = makeCurrencyFormatter(currencies);
  const lastIndex = data.length - 1;

  return (
    <div className="h-64 w-full" data-testid="revenue-trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDayTick}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            allowDecimals={false}
            tickCount={4}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeOpacity: 0.35 }}
            content={<CustomTooltip formatCurrency={formatCurrency} />}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--brand-accent)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="var(--brand-accent)"
            fillOpacity={0.1}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number; key?: React.Key | null }) => (
              <EndDot key={props.key ?? props.index} cx={props.cx} cy={props.cy} index={props.index} lastIndex={lastIndex} />
            )}
            activeDot={{ r: 4, fill: "var(--brand-accent)", stroke: "var(--card)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
