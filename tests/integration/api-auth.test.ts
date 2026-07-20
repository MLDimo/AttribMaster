import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

// Simule une requête sans session : auth() renvoie null (comme en prod pour
// un visiteur non connecté). Sans ce mock, auth() lève une erreur framework
// ("headers outside a request scope") hors du runtime Next, ce qui ne
// correspond pas au chemin réellement exercé en production.
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

import { GET as overviewGet } from "@/app/api/overview/route";
import { GET as transactionsGet } from "@/app/api/transactions/route";
import { GET as exportGet } from "@/app/api/transactions/export/route";
import { GET as projectsGet } from "@/app/api/projects/route";
import { GET as accountGet } from "@/app/api/account/route";
import { MOCK_PROJECT_ID } from "@/lib/attribution/mock-data";

// Un projet demandé sans session doit produire un 401 propre — pas un 500
// générique qui pollue les logs d'erreur à chaque passage de bot (régression
// corrigée après un check complet de la prod). Le projet démo (MOCK_PROJECT_ID)
// est en lecture publique pour tout utilisateur CONNECTÉ, mais reste bloqué
// pour un visiteur anonyme au même titre qu'un vrai projet.
const REAL_LOOKING_PROJECT_ID = "00000000-0000-4000-8000-000000000000";
const RANGE = { from: "2000-01-01", to: "2100-01-01" };

describe("unauthenticated API access returns 401, not 500", () => {
  it("GET /api/overview", async () => {
    const search = new URLSearchParams({ projectId: REAL_LOOKING_PROJECT_ID, ...RANGE });
    const res = await overviewGet(new NextRequest(`http://localhost/api/overview?${search}`));
    expect(res.status).toBe(401);
  });

  it("GET /api/transactions", async () => {
    const search = new URLSearchParams({ projectId: REAL_LOOKING_PROJECT_ID, ...RANGE });
    const res = await transactionsGet(new NextRequest(`http://localhost/api/transactions?${search}`));
    expect(res.status).toBe(401);
  });

  it("GET /api/transactions/export", async () => {
    const search = new URLSearchParams({ projectId: REAL_LOOKING_PROJECT_ID, ...RANGE });
    const res = await exportGet(new NextRequest(`http://localhost/api/transactions/export?${search}`));
    expect(res.status).toBe(401);
  });

  it("GET /api/projects", async () => {
    const res = await projectsGet();
    expect(res.status).toBe(401);
  });

  it("GET /api/account", async () => {
    const res = await accountGet();
    expect(res.status).toBe(401);
  });

  it("GET /api/overview for the demo project (MOCK_PROJECT_ID)", async () => {
    const search = new URLSearchParams({ projectId: MOCK_PROJECT_ID, ...RANGE });
    const res = await overviewGet(new NextRequest(`http://localhost/api/overview?${search}`));
    expect(res.status).toBe(401);
  });
});
