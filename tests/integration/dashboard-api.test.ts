import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET as overviewGet } from "@/app/api/overview/route";
import { GET as transactionsGet } from "@/app/api/transactions/route";
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

  it("sorts by revenue descending on request", async () => {
    const res = await transactionsGet(
      new NextRequest(transactionsUrl({ sortBy: "purchase_revenue", sortDir: "desc", pageSize: "50" }))
    );
    const json = await res.json();
    const revenues = json.rows.map((r: { purchase_revenue: number }) => r.purchase_revenue);
    const sorted = [...revenues].sort((a, b) => b - a);
    expect(revenues).toEqual(sorted);
  });
});
