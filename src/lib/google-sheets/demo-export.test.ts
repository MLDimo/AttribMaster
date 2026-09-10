import { beforeEach, describe, expect, it, vi } from "vitest";

const exportTransactionsToSheet = vi.fn(async (_token: string, _id: string, rows: unknown[]) => rows.length);
const getProjectOAuthToken = vi.fn(async (_projectId: string): Promise<string | null> => "a-refresh-token");

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  exportTransactionsToSheet,
}));
vi.mock("@/lib/projects/repository", () => ({ getProjectOAuthToken }));

function row(daysAgo: number) {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    transaction_id: `t-${daysAgo}`,
    user_pseudo_id: "u1",
    event_date: date.toISOString().slice(0, 10),
    event_timestamp: date.toISOString(),
    purchase_revenue: 10,
    currency: "EUR",
    source_path: "google / cpc",
    touchpoints: [],
  };
}

vi.mock("@/lib/attribution/mock-data", () => ({
  getMockRows: () => [row(5), row(89), row(91), row(400)],
}));

describe("runDemoGoogleSheetExport", () => {
  beforeEach(() => {
    exportTransactionsToSheet.mockClear();
    getProjectOAuthToken.mockClear();
  });

  it("ne fait rien si le projet source du jeton n'est plus connecté (jamais d'exception)", async () => {
    getProjectOAuthToken.mockResolvedValueOnce(null);
    const { runDemoGoogleSheetExport } = await import("./demo-export");

    const result = await runDemoGoogleSheetExport();

    expect(result).toBeNull();
    expect(exportTransactionsToSheet).not.toHaveBeenCalled();
  });

  it("exporte vers l'ID extrait de l'URL fixée, avec le jeton du projet source", async () => {
    const { runDemoGoogleSheetExport } = await import("./demo-export");

    await runDemoGoogleSheetExport();

    expect(getProjectOAuthToken).toHaveBeenCalledWith("07f5ced7-3ce8-4cca-803d-2cae755335c6");
    expect(exportTransactionsToSheet).toHaveBeenCalledWith(
      "a-refresh-token",
      "1TS7Ngtz2RLGC0euPvDKaakmRWMI89pS4SrRaImp15YA",
      expect.any(Array)
    );
  });

  it("ne garde que les 90 derniers jours, comme l'export des vrais projets", async () => {
    const { runDemoGoogleSheetExport } = await import("./demo-export");

    await runDemoGoogleSheetExport();

    const rows = exportTransactionsToSheet.mock.calls[0][2] as { transaction_id: string }[];
    expect(rows.map((r) => r.transaction_id)).toEqual(["t-5", "t-89"]);
  });
});
