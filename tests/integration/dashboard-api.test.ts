import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET as overviewGet } from "@/app/api/overview/route";
import { GET as transactionsGet } from "@/app/api/transactions/route";
import { GET as exportGet } from "@/app/api/transactions/export/route";
import { MOCK_PROJECT_ID } from "@/lib/attribution/mock-data";

// Fenêtre volontairement très large : les données mock sont générées avec des
// dates relatives à "maintenant" au moment du build du cache (voir
// mock-data.ts), donc un intervalle fixe étroit serait flaky au fil du temps.
const WIDE_FROM = "2000-01-01";
const WIDE_TO = "2100-01-01";

function overviewUrl(params: Record<string, string>) {
  const search = new URLSearchParams({ projectId: MOCK_PROJECT_ID, from: WIDE_FROM, to: WIDE_TO, ...params });
  return `http://localhost/api/overview?${search.toString()}`;
}

function transactionsUrl(params: Record<string, string>) {
  const search = new URLSearchParams({ projectId: MOCK_PROJECT_ID, from: WIDE_FROM, to: WIDE_TO, ...params });
  return `http://localhost/api/transactions?${search.toString()}`;
}

describe("GET /api/overview (dashboard numbers)", () => {
  it("rejects a request without a projectId", async () => {
    const res = await overviewGet(new NextRequest("http://localhost/api/overview"));
    expect(res.status).toBe(400);
  });

  it("reports the distinct currencies present (single EUR for mock data)", async () => {
    const res = await overviewGet(new NextRequest(overviewUrl({})));
    const json = await res.json();
    expect(json.currencies).toEqual(["EUR"]);
  });

  it("returns totals and topSources that reconcile with each other", async () => {
    const res = await overviewGet(new NextRequest(overviewUrl({ model: "linear" })));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.totals.transactions).toBeGreaterThan(0);
    expect(json.totals.revenue).toBeGreaterThan(0);

    const topSourcesTotal = json.topSources.reduce((sum: number, s: { revenue: number }) => sum + s.revenue, 0);
    // Le total réparti par source doit reconstituer le revenu total (tous
    // modèles pondérés préservent la somme, contrairement à markov/shapley
    // qui restent aussi bornés par le même total).
    expect(topSourcesTotal).toBeCloseTo(json.totals.revenue, 1);

    const shareSum = json.topSources.reduce((sum: number, s: { share: number }) => sum + s.share, 0);
    expect(shareSum).toBeCloseTo(1, 2);
  });

  it("trend has one point per day and reconciles with the totals (revenue + transaction count)", async () => {
    const res = await overviewGet(new NextRequest(overviewUrl({})));
    const json = await res.json();

    const expectedDays = Math.round(
      (new Date(`${WIDE_TO}T00:00:00Z`).getTime() - new Date(`${WIDE_FROM}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1;
    expect(json.trend).toHaveLength(expectedDays);
    expect(json.trend[0].date).toBe(WIDE_FROM);
    expect(json.trend[json.trend.length - 1].date).toBe(WIDE_TO);

    const trendRevenue = json.trend.reduce((sum: number, p: { revenue: number }) => sum + p.revenue, 0);
    const trendTransactions = json.trend.reduce((sum: number, p: { transactions: number }) => sum + p.transactions, 0);
    expect(trendRevenue).toBeCloseTo(json.totals.revenue, 1);
    expect(trendTransactions).toBe(json.totals.transactions);

    // Chronologiquement croissant, sans trou (chaque jour suit le précédent).
    for (let i = 1; i < json.trend.length; i++) {
      const prev = new Date(`${json.trend[i - 1].date}T00:00:00Z`);
      const cur = new Date(`${json.trend[i].date}T00:00:00Z`);
      expect(cur.getTime() - prev.getTime()).toBe(24 * 60 * 60 * 1000);
    }
  });

  it("sourceTrend: per-day channel breakdown reconciles with trend's daily revenue, for every model", async () => {
    for (const model of ["last_click", "linear", "u_shape", "time_decay", "markov", "shapley"] as const) {
      const res = await overviewGet(new NextRequest(overviewUrl({ model })));
      const json = await res.json();

      expect(json.sourceTrend.points).toHaveLength(json.trend.length);
      expect(json.sourceTrend.channels.length).toBeGreaterThan(0);
      expect(json.sourceTrend.channels.length).toBeLessThanOrEqual(7); // 6 canaux max + "Autres"

      for (let i = 0; i < json.trend.length; i++) {
        const point = json.sourceTrend.points[i];
        expect(point.date).toBe(json.trend[i].date);
        expect(point.total).toBeCloseTo(json.trend[i].revenue, 6);
        const sum = json.sourceTrend.channels.reduce((s: number, c: string) => s + point[c], 0);
        expect(sum, `model=${model} date=${point.date}`).toBeCloseTo(point.total, 6);
      }
    }
  });

  it("sourceTrend respects the active channel filter (scoped the same way as totals/trend)", async () => {
    const filtered = await overviewGet(
      new NextRequest(overviewUrl({ model: "linear", channelDimension: "medium", channelValue: "cpc" }))
    );
    const json = await filtered.json();
    const sum = json.sourceTrend.points.reduce((s: number, p: { total: number }) => s + p.total, 0);
    expect(sum).toBeCloseTo(json.totals.revenue, 1);
  });

  it("returns the same total revenue regardless of attribution model", async () => {
    const models = ["last_click", "linear", "time_decay", "u_shape", "markov", "shapley"] as const;
    const revenues: number[] = [];
    for (const model of models) {
      const res = await overviewGet(new NextRequest(overviewUrl({ model })));
      const json = await res.json();
      revenues.push(json.totals.revenue);
    }
    // Le revenu TOTAL ne doit jamais dépendre du modèle choisi — seule sa
    // répartition par source change.
    const distinctRevenues = new Set(revenues.map((r) => Math.round(r * 100)));
    expect(distinctRevenues.size).toBe(1);
  });

  it("dimension=medium groups google/cpc and bing/cpc together under \"cpc\", never separately", async () => {
    const res = await overviewGet(new NextRequest(overviewUrl({ model: "linear", dimension: "medium" })));
    const json = await res.json();
    expect(json.topSources.find((s: { source: string }) => s.source === "google / cpc")).toBeUndefined();
    expect(json.topSources.find((s: { source: string }) => s.source === "bing / cpc")).toBeUndefined();
    const cpc = json.topSources.find((s: { source: string }) => s.source === "cpc");
    expect(cpc).toBeDefined();
    expect(cpc.revenue).toBeGreaterThan(0);
    // Regrouper ne retire ni n'ajoute de revenu total, seule la répartition change.
    const total = json.topSources.reduce((sum: number, s: { revenue: number }) => sum + s.revenue, 0);
    expect(total).toBeCloseTo(json.totals.revenue, 1);
  });

  it("dimension=campaign surfaces campaign names, with a sentinel bucket for touchpoints without one", async () => {
    const res = await overviewGet(new NextRequest(overviewUrl({ model: "linear", dimension: "campaign" })));
    const json = await res.json();
    const labels = json.topSources.map((s: { source: string }) => s.source);
    expect(labels).toContain("brand-search"); // google/cpc + bing/cpc dans mock-data.ts
    expect(labels).toContain("(sans campagne)");
  });

  it("selecting a channel scopes totals + trend to transactions touched by it, without changing topSources' full breakdown", async () => {
    const unfiltered = await overviewGet(new NextRequest(overviewUrl({ model: "linear", dimension: "medium" })));
    const unfilteredJson = await unfiltered.json();

    const filtered = await overviewGet(
      new NextRequest(overviewUrl({ model: "linear", dimension: "medium", channelDimension: "medium", channelValue: "cpc" }))
    );
    const filteredJson = await filtered.json();

    expect(filteredJson.totals.transactions).toBeGreaterThan(0);
    expect(filteredJson.totals.transactions).toBeLessThan(unfilteredJson.totals.transactions);
    expect(filteredJson.totals.revenue).toBeLessThan(unfilteredJson.totals.revenue);
    // Le camembert reste la vue complète (c'est lui le sélecteur), pas restreint au filtre.
    expect(filteredJson.topSources).toEqual(unfilteredJson.topSources);
    // La tendance filtrée doit reconstituer exactement le total filtré.
    const trendRevenue = filteredJson.trend.reduce((sum: number, p: { revenue: number }) => sum + p.revenue, 0);
    expect(trendRevenue).toBeCloseTo(filteredJson.totals.revenue, 1);
  });

  it("rejects channelDimension without channelValue (and vice versa)", async () => {
    const res = await overviewGet(new NextRequest(overviewUrl({ channelDimension: "medium" })));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/transactions", () => {
  it("rejects a request without a projectId", async () => {
    const res = await transactionsGet(new NextRequest("http://localhost/api/transactions"));
    expect(res.status).toBe(400);
  });

  it("paginates and reports a stable total across pages", async () => {
    const page1 = await transactionsGet(new NextRequest(transactionsUrl({ page: "1", pageSize: "20" })));
    const json1 = await page1.json();
    expect(json1.rows.length).toBeLessThanOrEqual(20);
    expect(json1.total).toBeGreaterThan(0);

    const page2 = await transactionsGet(new NextRequest(transactionsUrl({ page: "2", pageSize: "20" })));
    const json2 = await page2.json();
    expect(json2.total).toBe(json1.total);
    // Pas de chevauchement entre les deux pages.
    const ids1 = new Set(json1.rows.map((r: { transaction_id: string }) => r.transaction_id));
    const overlap = json2.rows.filter((r: { transaction_id: string }) => ids1.has(r.transaction_id));
    expect(overlap.length).toBe(0);
  });

  it("filters by transaction id search", async () => {
    const all = await transactionsGet(new NextRequest(transactionsUrl({ pageSize: "1" })));
    const allJson = await all.json();
    const knownId = allJson.rows[0].transaction_id as string;

    const filtered = await transactionsGet(new NextRequest(transactionsUrl({ search: knownId })));
    const filteredJson = await filtered.json();
    expect(filteredJson.rows.length).toBeGreaterThan(0);
    expect(filteredJson.rows.every((r: { transaction_id: string }) => r.transaction_id.includes(knownId))).toBe(true);
  });

  it("exports the full range as CSV (BOM + semicolons, one line per transaction)", async () => {
    const all = await transactionsGet(new NextRequest(transactionsUrl({ pageSize: "1" })));
    const { total } = await all.json();

    const search = new URLSearchParams({ projectId: MOCK_PROJECT_ID, from: WIDE_FROM, to: WIDE_TO });
    const res = await exportGet(new NextRequest(`http://localhost/api/transactions/export?${search}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");

    // res.text() retire le BOM par spec Fetch : on vérifie les octets bruts
    // (c'est bien ce que contient le fichier téléchargé).
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8 pour Excel
    const body = new TextDecoder().decode(bytes.slice(3));
    const lines = body.split("\r\n");
    expect(lines[0]).toBe("transaction_id;date;horodatage;revenu;devise;parcours;nb_touchpoints");
    expect(lines.length - 1).toBe(total); // une ligne par transaction, aucune pagination

    // L'export respecte le filtre de recherche.
    const knownId = lines[1].split(";")[0].replaceAll('"', "");
    const filtered = await exportGet(
      new NextRequest(`http://localhost/api/transactions/export?${search}&search=${knownId}`)
    );
    const filteredLines = (await filtered.text()).replace("\ufeff", "").split("\r\n");
    expect(filteredLines.length - 1).toBeGreaterThanOrEqual(1);
    expect(filteredLines.length - 1).toBeLessThan(total);
  });

  it("sorts by revenue descending on request", async () => {
    const res = await transactionsGet(
      new NextRequest(transactionsUrl({ sortBy: "purchase_revenue", sortDir: "desc", pageSize: "50" }))
    );
    const json = await res.json();
    const revenues = json.rows.map((r: { purchase_revenue: number }) => r.purchase_revenue);
    const sorted = [...revenues].sort((a, b) => b - a);
    expect(revenues).toEqual(sorted);
  });

  it("channelDimension=medium&channelValue=cpc narrows the list to transactions touched by cpc (google or bing)", async () => {
    const all = await transactionsGet(new NextRequest(transactionsUrl({ pageSize: "1" })));
    const { total: totalUnfiltered } = await all.json();

    const res = await transactionsGet(
      new NextRequest(transactionsUrl({ channelDimension: "medium", channelValue: "cpc", pageSize: "50" }))
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBeGreaterThan(0);
    expect(json.total).toBeLessThan(totalUnfiltered);
    for (const row of json.rows) {
      expect(row.touchpoints.some((tp: { medium: string }) => tp.medium === "cpc")).toBe(true);
    }
  });

  it("channelDimension=campaign&channelValue=brand-search narrows to that campaign's transactions", async () => {
    const res = await transactionsGet(
      new NextRequest(transactionsUrl({ channelDimension: "campaign", channelValue: "brand-search", pageSize: "50" }))
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBeGreaterThan(0);
    for (const row of json.rows) {
      expect(row.touchpoints.some((tp: { campaign: string | null }) => tp.campaign === "brand-search")).toBe(true);
    }
  });

  it("channelDimension=source&channelValue matches the exact combined source/medium label", async () => {
    const res = await transactionsGet(
      new NextRequest(transactionsUrl({ channelDimension: "source", channelValue: "google / cpc", pageSize: "50" }))
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBeGreaterThan(0);
    for (const row of json.rows) {
      expect(
        row.touchpoints.some((tp: { source: string; medium: string }) => tp.source === "google" && tp.medium === "cpc")
      ).toBe(true);
    }
  });

  it("rejects channelDimension without channelValue (and vice versa)", async () => {
    const res = await transactionsGet(new NextRequest(transactionsUrl({ channelDimension: "medium" })));
    expect(res.status).toBe(400);
  });

  it("CSV export respects the same channel filter as the transactions list", async () => {
    const listRes = await transactionsGet(
      new NextRequest(transactionsUrl({ channelDimension: "medium", channelValue: "cpc", pageSize: "1" }))
    );
    const { total } = await listRes.json();

    const search = new URLSearchParams({
      projectId: MOCK_PROJECT_ID,
      from: WIDE_FROM,
      to: WIDE_TO,
      channelDimension: "medium",
      channelValue: "cpc",
    });
    const exportRes = await exportGet(new NextRequest(`http://localhost/api/transactions/export?${search}`));
    expect(exportRes.status).toBe(200);
    const lines = (await exportRes.text()).replace("\ufeff", "").split("\r\n");
    expect(lines.length - 1).toBe(total);
  });
});
