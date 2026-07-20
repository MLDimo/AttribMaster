import { describe, expect, it } from "vitest";

import { comparisonRange, defaultRange } from "./date-range";

describe("defaultRange", () => {
  it("spans exactly 7 days, ending today", () => {
    const { from, to } = defaultRange();
    const today = new Date().toISOString().slice(0, 10);
    expect(to).toBe(today);
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (24 * 60 * 60 * 1000);
    expect(days).toBe(6); // 7 jours inclus (from et to compris)
  });
});

describe("comparisonRange", () => {
  it("previous_period: same duration, immediately before, no overlap", () => {
    const { from, to } = comparisonRange("2026-07-14", "2026-07-20", "previous_period");
    expect(to).toBe("2026-07-13"); // veille du début de la période courante
    expect(from).toBe("2026-07-07"); // même durée (7 jours) que 14->20
  });

  it("previous_period: a single-day range compares against the single day before", () => {
    const { from, to } = comparisonRange("2026-07-20", "2026-07-20", "previous_period");
    expect(from).toBe("2026-07-19");
    expect(to).toBe("2026-07-19");
  });

  it("last_week: shifts both bounds back exactly 7 days", () => {
    const { from, to } = comparisonRange("2026-07-14", "2026-07-20", "last_week");
    expect(from).toBe("2026-07-07");
    expect(to).toBe("2026-07-13");
  });

  it("last_month: normal case shifts the calendar month back, same day-of-month", () => {
    const { from, to } = comparisonRange("2026-07-14", "2026-07-20", "last_month");
    expect(from).toBe("2026-06-14");
    expect(to).toBe("2026-06-20");
  });

  it("last_month: clamps to the last valid day instead of overflowing into the next month", () => {
    // 31 mars -> 31 février n'existe pas : doit retomber sur le dernier jour de février.
    const { from } = comparisonRange("2026-03-31", "2026-03-31", "last_month");
    expect(from).toBe("2026-02-28"); // 2026 n'est pas bissextile
  });

  it("last_month: clamps correctly across a leap-year February", () => {
    const { from } = comparisonRange("2028-03-31", "2028-03-31", "last_month");
    expect(from).toBe("2028-02-29"); // 2028 est bissextile
  });

  it("previous_year: shifts 12 months back, same day-of-month", () => {
    const { from, to } = comparisonRange("2026-07-14", "2026-07-20", "previous_year");
    expect(from).toBe("2025-07-14");
    expect(to).toBe("2025-07-20");
  });

  it("previous_year: Feb 29 clamps to Feb 28 in a non-leap target year", () => {
    const { from } = comparisonRange("2028-02-29", "2028-02-29", "previous_year");
    expect(from).toBe("2027-02-28");
  });

  it("defaults to previous_period for an unrecognized mode value", () => {
    // La signature TypeScript interdit normalement une valeur hors union, mais
    // le code défensif (switch/default) doit rester couvert si jamais une
    // requête HTTP mal formée passait au travers du zod enum en amont.
    const fallback = comparisonRange("2026-07-14", "2026-07-20", "unexpected" as never);
    const expected = comparisonRange("2026-07-14", "2026-07-20", "previous_period");
    expect(fallback).toEqual(expected);
  });
});
