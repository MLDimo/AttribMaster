"use client";

import { useRef } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { colorForSource } from "@/lib/attribution/colors";
import { OTHER_CHANNEL_LABEL, type DailySourceTrend, type DailyTrendPoint } from "@/lib/attribution/trend";

const OTHER_CHANNEL_COLOR = "var(--muted-foreground)";

function channelColor(channel: string): string {
  return channel === OTHER_CHANNEL_LABEL ? OTHER_CHANNEL_COLOR : colorForSource(channel);
}

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

type MergedPoint = { date: string; total: number; transactions: number } & Record<string, number | string>;

function CustomTooltip({
  active,
  payload,
  channels,
  formatCurrency,
}: {
  active?: boolean;
  payload?: { payload: MergedPoint }[];
  channels: string[];
  formatCurrency: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="mb-1.5 text-xs text-muted-foreground">{formatDayFull(point.date)}</p>
      <div className="flex items-center gap-2">
        <span className="h-0.5 w-3 shrink-0 rounded-full bg-brand-accent" />
        <span className="font-mono font-semibold tabular-nums">{formatCurrency(point.total)}</span>
        <span className="text-xs text-muted-foreground">total</span>
      </div>
      {channels.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-0.5 border-t border-border pt-1.5">
          {[...channels]
            .sort((a, b) => (point[b] as number) - (point[a] as number))
            .map((channel) => (
              <div key={channel} className="flex items-center gap-2">
                <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: channelColor(channel) }} />
                <span className="font-mono text-xs tabular-nums">{formatCurrency(point[channel] as number)}</span>
                <span className="max-w-32 truncate text-xs text-muted-foreground">{channel}</span>
              </div>
            ))}
        </div>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">
        {point.transactions} transaction{point.transactions > 1 ? "s" : ""}
      </p>
    </div>
  );
}

/**
 * Point d'une courbe SVG le plus proche d'une abscisse donnée, par recherche
 * binaire sur la longueur d'arc (la courbe est monotone en x, donc l'abscisse
 * croît avec la longueur — la recherche binaire converge correctement).
 */
function nearestPointOnPath(path: SVGPathElement, targetX: number): { x: number; y: number } {
  let lo = 0;
  let hi = path.getTotalLength();
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (path.getPointAtLength(mid).x < targetX) lo = mid;
    else hi = mid;
  }
  return path.getPointAtLength((lo + hi) / 2);
}

/** Distance maximale (px, en coordonnées SVG) au-delà de laquelle un clic est
 * considéré comme n'ayant touché aucune courbe (clic dans une zone vide, ou
 * sur l'aire totale, qui n'est volontairement pas sélectionnable). */
const CLICK_HIT_TOLERANCE_PX = 14;

/**
 * Détermine, pour un clic dans la zone du graphe, quelle courbe de canal est
 * réellement la plus proche — par distance géométrique réelle, pas par
 * z-order SVG. Nécessaire car plusieurs canaux peuvent avoir des valeurs très
 * proches (donc des tracés à quelques pixels l'un de l'autre) : un simple
 * tracé invisible élargi par canal (`pointerEvents: "stroke"`) laisse le
 * navigateur choisir arbitrairement le tracé au-dessus dans le DOM dès que
 * deux corridors se recouvrent, ce qui sélectionnait parfois un canal sans
 * rapport avec celui visé — voir le bug rapporté par l'utilisateur.
 */
function findNearestChannel(
  svg: SVGSVGElement,
  channels: string[],
  clientX: number,
  clientY: number
): string | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const { x: svgX, y: svgY } = point.matrixTransform(ctm.inverse());

  const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path.recharts-line-curve")).filter(
    (p) => p.getAttribute("stroke") !== "transparent"
  );
  if (paths.length !== channels.length) return null; // défensif : ordre attendu = celui de `channels`

  let closestChannel: string | null = null;
  let closestDistance = Infinity;
  channels.forEach((channel, i) => {
    const { y } = nearestPointOnPath(paths[i], svgX);
    const distance = Math.abs(y - svgY);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestChannel = channel;
    }
  });

  return closestDistance <= CLICK_HIT_TOLERANCE_PX ? closestChannel : null;
}

/** Point terminal marqué (le reste de la série n'est pas labellisé un par un). */
function EndDot({
  cx,
  cy,
  index,
  lastIndex,
  color,
}: {
  cx?: number;
  cy?: number;
  index?: number;
  lastIndex: number;
  color: string;
}) {
  if (index !== lastIndex || cx === undefined || cy === undefined) return null;
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="var(--card)" strokeWidth={2} />;
}

/** Légende horizontale, cliquable : requise dès que ≥2 séries sont tracées (voir la skill dataviz). */
function Legend({
  channels,
  selectedChannel,
  onSelectChannel,
}: {
  channels: string[];
  selectedChannel?: string | null;
  onSelectChannel?: (channel: string | null) => void;
}) {
  if (channels.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 px-1 text-xs text-muted-foreground">
      {channels.map((channel) => {
        const dimmed = Boolean(selectedChannel) && selectedChannel !== channel;
        return (
          <button
            key={channel}
            type="button"
            onClick={() => onSelectChannel?.(selectedChannel === channel ? null : channel)}
            className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-opacity hover:opacity-100 ${
              dimmed ? "opacity-40" : "opacity-100"
            } ${onSelectChannel ? "cursor-pointer" : "cursor-default"}`}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: channelColor(channel) }} />
            <span className="max-w-40 truncate">{channel}</span>
          </button>
        );
      })}
    </div>
  );
}

export function RevenueTrendChart({
  trend,
  sourceTrend,
  currencies = ["EUR"],
  selectedChannel,
  onSelectChannel,
}: {
  trend: DailyTrendPoint[];
  sourceTrend: DailySourceTrend;
  currencies?: string[];
  selectedChannel?: string | null;
  onSelectChannel?: (channel: string | null) => void;
}) {
  const formatCurrency = makeCurrencyFormatter(currencies);
  const channels = sourceTrend.channels;
  const lastIndex = trend.length - 1;
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  function handleChartClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!onSelectChannel || channels.length === 0) return;
    const svg = chartWrapperRef.current?.querySelector("svg");
    if (!svg) return;
    const nearest = findNearestChannel(svg, channels, event.clientX, event.clientY);
    if (nearest) onSelectChannel(selectedChannel === nearest ? null : nearest);
  }

  // `total`/`transactions` viennent de `trend` (qui porte aussi le nombre de
  // transactions, absent de sourceTrend) ; les valeurs par canal viennent de
  // `sourceTrend`, calculées à part au jour de l'ACHAT — les deux tableaux
  // partagent exactement la même séquence de dates par construction.
  const data: MergedPoint[] = trend.map((t, i) => ({
    date: t.date,
    total: t.revenue,
    transactions: t.transactions,
    ...(sourceTrend.points[i] as unknown as Record<string, number>),
  }));

  return (
    <div className="flex flex-col gap-3" data-testid="revenue-trend-chart">
      <div ref={chartWrapperRef} className="h-64 w-full" onClick={handleChartClick}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              content={<CustomTooltip channels={channels} formatCurrency={formatCurrency} />}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--brand-accent)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="var(--brand-accent)"
              fillOpacity={0.1}
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; index?: number; key?: React.Key | null }) => (
                <EndDot
                  key={props.key ?? props.index}
                  cx={props.cx}
                  cy={props.cy}
                  index={props.index}
                  lastIndex={lastIndex}
                  color="var(--brand-accent)"
                />
              )}
              activeDot={{ r: 4, fill: "var(--brand-accent)", stroke: "var(--card)", strokeWidth: 2 }}
            />
            {channels.map((channel) => {
              const dimmed = Boolean(selectedChannel) && selectedChannel !== channel;
              const color = channelColor(channel);
              return (
                <Line
                  key={channel}
                  type="monotone"
                  dataKey={channel}
                  stroke={color}
                  strokeOpacity={dimmed ? 0.25 : 1}
                  strokeWidth={selectedChannel === channel ? 3 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={(props: { cx?: number; cy?: number; index?: number; key?: React.Key | null }) => (
                    <EndDot
                      key={props.key ?? props.index}
                      cx={props.cx}
                      cy={props.cy}
                      index={props.index}
                      lastIndex={lastIndex}
                      color={color}
                    />
                  )}
                  activeDot={{ r: 3, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend channels={channels} selectedChannel={selectedChannel} onSelectChannel={onSelectChannel} />
    </div>
  );
}
