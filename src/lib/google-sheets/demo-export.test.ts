import { beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN_SOURCE_PROJECT_ID = "49bb2b76-f701-4ae4-885e-0a6b280fd0b1";
const CONFIGURED_URL = "https://docs.google.com/spreadsheets/d/1TS7Ngtz2RLGC0euPvDKaakmRWMI89pS4SrRaImp15YA/edit";

const exportTransactionsToSheet = vi.fn(async (_token: string, _id: string, rows: unknown[]) => rows.length);
const getSheetPreview = vi.fn(async (_token: string, _id: string) => ({ title: "Export AttribMaster Demo project", rowCount: 42 }));
const getProjectOAuthToken = vi.fn(async (_projectId: string): Promise<string | null> => "a-refresh-token");
const dbQuery = vi.fn(async (_sql: string, _params: unknown[]): Promise<{ rows: { export_google_sheet_url: string | null }[] }> => ({
  rows: [{ export_google_sheet_url: CONFIGURED_URL }],
}));

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  exportTransactionsToSheet,
  getSheetPreview,
}));
vi.mock("@/lib/projects/repository", () => ({ getProjectOAuthToken }));
vi.mock("@/lib/db/client", () => ({ getDbPool: () => ({ query: dbQuery }) }));

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
    getSheetPreview.mockClear();
    getProjectOAuthToken.mockClear();
    dbQuery.mockClear();
    dbQuery.mockResolvedValue({ rows: [{ export_google_sheet_url: CONFIGURED_URL }] });
  });

  it("ne fait rien si aucune feuille n'est encore choisie sur le projet source", async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ export_google_sheet_url: null }] });
    const { runDemoGoogleSheetExport } = await import("./demo-export");

    const result = await runDemoGoogleSheetExport();

    expect(result).toBeNull();
    expect(exportTransactionsToSheet).not.toHaveBeenCalled();
  });

  it("ne fait rien si le projet source du jeton n'est plus connecté (jamais d'exception)", async () => {
    getProjectOAuthToken.mockResolvedValueOnce(null);
    const { runDemoGoogleSheetExport } = await import("./demo-export");

    const result = await runDemoGoogleSheetExport();

    expect(result).toBeNull();
    expect(exportTransactionsToSheet).not.toHaveBeenCalled();
  });

  it("exporte vers l'ID lu sur le projet source, avec le jeton du même projet", async () => {
    const { runDemoGoogleSheetExport } = await import("./demo-export");

    await runDemoGoogleSheetExport();

    expect(dbQuery).toHaveBeenCalledWith(expect.stringContaining("export_google_sheet_url"), [
      TOKEN_SOURCE_PROJECT_ID,
    ]);
    expect(getProjectOAuthToken).toHaveBeenCalledWith(TOKEN_SOURCE_PROJECT_ID);
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

describe("getDemoGoogleSheetExportStatus", () => {
  beforeEach(() => {
    exportTransactionsToSheet.mockClear();
    getSheetPreview.mockClear();
    getProjectOAuthToken.mockClear();
    dbQuery.mockClear();
    dbQuery.mockResolvedValue({ rows: [{ export_google_sheet_url: CONFIGURED_URL }] });
  });

  it("renvoie le titre et le nombre de lignes en lecture seule, sans jamais écrire", async () => {
    const { getDemoGoogleSheetExportStatus } = await import("./demo-export");

    const status = await getDemoGoogleSheetExportStatus();

    expect(status).toEqual({
      spreadsheetUrl: CONFIGURED_URL,
      spreadsheetTitle: "Export AttribMaster Demo project",
      rowCount: 42,
    });
    expect(exportTransactionsToSheet).not.toHaveBeenCalled();
  });

  it("renvoie une URL null tant qu'aucune feuille n'est choisie, sans appeler Google", async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ export_google_sheet_url: null }] });
    const { getDemoGoogleSheetExportStatus } = await import("./demo-export");

    const status = await getDemoGoogleSheetExportStatus();

    expect(status).toEqual({ spreadsheetUrl: null, spreadsheetTitle: null, rowCount: null });
    expect(getSheetPreview).not.toHaveBeenCalled();
  });

  it("retombe sur un titre null (pas une exception) si le projet source n'a plus de jeton", async () => {
    getProjectOAuthToken.mockResolvedValueOnce(null);
    const { getDemoGoogleSheetExportStatus } = await import("./demo-export");

    const status = await getDemoGoogleSheetExportStatus();

    expect(status.spreadsheetTitle).toBeNull();
    expect(status.rowCount).toBeNull();
    expect(getSheetPreview).not.toHaveBeenCalled();
  });

  it("retombe sur un titre null (pas une exception) si l'appel Google échoue", async () => {
    getSheetPreview.mockRejectedValueOnce(new Error("boom"));
    const { getDemoGoogleSheetExportStatus } = await import("./demo-export");

    const status = await getDemoGoogleSheetExportStatus();

    expect(status.spreadsheetTitle).toBeNull();
    expect(status.rowCount).toBeNull();
  });
});
