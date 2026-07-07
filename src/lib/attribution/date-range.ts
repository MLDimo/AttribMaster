export type ComparisonMode = "previous_period" | "last_week" | "last_month";

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 6 * 24 * 60 * 60 * 1000);
  return { from: toISODate(from), to: toISODate(to) };
}

function shiftDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

function shiftMonths(dateStr: string, months: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = date.getUTCDate();

  // Shift by full months first (from day 1, to avoid overflow), then clamp
  // the day back to the last valid day of the target month (e.g. 31 -> 28/29
  // in February) instead of letting it roll into the following month.
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const daysInTargetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
  date.setUTCDate(Math.min(day, daysInTargetMonth));

  return toISODate(date);
}

/** Même durée, immédiatement avant la période donnée. */
function previousPeriodRange(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  const durationMs = toDate.getTime() - fromDate.getTime();

  const previousTo = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000);
  const previousFrom = new Date(previousTo.getTime() - durationMs);

  return { from: toISODate(previousFrom), to: toISODate(previousTo) };
}

/** Période de comparaison selon le mode choisi (N-1, semaine dernière, mois dernier). */
export function comparisonRange(
  from: string,
  to: string,
  mode: ComparisonMode
): { from: string; to: string } {
  switch (mode) {
    case "last_week":
      return { from: shiftDays(from, -7), to: shiftDays(to, -7) };
    case "last_month":
      return { from: shiftMonths(from, -1), to: shiftMonths(to, -1) };
    case "previous_period":
    default:
      return previousPeriodRange(from, to);
  }
}
