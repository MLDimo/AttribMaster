import { afterAll, describe, expect, it, vi } from "vitest";

// Session mutable, lue dynamiquement par le mock @/auth : permet de rejouer
// createProject/addProjectMember/getProjectWithAccess "en tant que" owner
// puis viewer dans le même test, comme le ferait une vraie requête HTTP.
let mockUserId: string | null = null;
vi.mock("@/auth", () => ({ auth: vi.fn(async () => (mockUserId ? { user: { id: mockUserId } } : null)) }));

import { NextRequest } from "next/server";

import { NotAuthorizedError } from "@/lib/auth/errors";
import { registerUser } from "@/lib/auth/registration";
import { MOCK_PROJECT_ID } from "@/lib/attribution/mock-data";
import { getDbPool } from "@/lib/db/client";
import {
  addProjectMember,
  createProject,
  getProjectWithAccess,
  hasProjectManageAccess,
  requireProjectAccess,
} from "@/lib/projects/repository";

import { GET as getProjectRoute, PATCH as patchProjectRoute, DELETE as deleteProjectRoute } from "@/app/api/projects/[id]/route";
import { POST as refreshPost } from "@/app/api/projects/[id]/refresh/route";
import { POST as connectBigQueryPost } from "@/app/api/projects/[id]/connect-bigquery/route";
import { GET as gcpProjectsGet } from "@/app/api/projects/[id]/gcp-projects/route";
import { GET as gcpDatasetsGet } from "@/app/api/projects/[id]/gcp-datasets/route";
import { PUT as customModelPut, DELETE as customModelDelete } from "@/app/api/projects/[id]/custom-model/route";
import { PUT as sheetExportPut } from "@/app/api/projects/[id]/google-sheet-export/route";
import { getCustomModelConfig } from "@/lib/projects/types";

function jsonPutRequest(body: unknown) {
  return new NextRequest("http://localhost", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const customModelPutRequest = jsonPutRequest;

const RUN_ID = Date.now();
const OWNER_EMAIL = `role-test-owner-${RUN_ID}@attribmaster.dev`;
const VIEWER_EMAIL = `role-test-viewer-${RUN_ID}@attribmaster.dev`;

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("project roles: read-only collaborator (project_members) vs workspace owner/admin", () => {
  afterAll(async () => {
    const pool = getDbPool();
    await pool.query(`delete from projects where name = 'Role test project'`);
    await pool.query(`delete from workspaces where id in (
      select wm.workspace_id from workspace_members wm
      join users u on u.id = wm.user_id where u.email in ($1, $2) and wm.role = 'owner')`, [
      OWNER_EMAIL,
      VIEWER_EMAIL,
    ]);
    await pool.query(`delete from users where email in ($1, $2)`, [OWNER_EMAIL, VIEWER_EMAIL]);
  });

  it("end-to-end: owner creates a project and invites a collaborator, who gets read access but never manage access", async () => {
    const db = getDbPool();
    const { userId: ownerId } = await registerUser("Role Owner", OWNER_EMAIL, "a-strong-password-123", "http://localhost");
    const { userId: viewerId } = await registerUser("Role Viewer", VIEWER_EMAIL, "a-strong-password-123", "http://localhost");
    const { rows: workspaceRows } = await db.query<{ workspace_id: string }>(
      `select workspace_id from workspace_members where user_id = $1 and role = 'owner'`,
      [ownerId]
    );
    const workspaceId = workspaceRows[0].workspace_id;

    mockUserId = ownerId;
    const project = await createProject({ name: "Role test project", accountId: workspaceId });
    await addProjectMember(project.id, VIEWER_EMAIL);

    const ownerAccess = await getProjectWithAccess(project.id);
    expect(ownerAccess?.canManage).toBe(true);
    await expect(requireProjectAccess(project.id, ownerId)).resolves.toBeUndefined();

    mockUserId = viewerId;
    const viewerAccess = await getProjectWithAccess(project.id);
    // Le viewer a bien accès en LECTURE au projet (project_members le couvre)...
    expect(viewerAccess?.project.id).toBe(project.id);
    // ...mais jamais en gestion : c'est la garantie "sans risque" du rôle lecture seule.
    expect(viewerAccess?.canManage).toBe(false);
    expect(await hasProjectManageAccess(project.id, viewerId)).toBe(false);
    await expect(requireProjectAccess(project.id, viewerId)).rejects.toBeInstanceOf(NotAuthorizedError);

    mockUserId = null;
  });

  it("every management route rejects the read-only collaborator with 403, none of them ever reaching Google/BigQuery", async () => {
    const db = getDbPool();
    const ownerEmail = `role-test-owner2-${RUN_ID}@attribmaster.dev`;
    const viewerEmail = `role-test-viewer2-${RUN_ID}@attribmaster.dev`;
    const { userId: ownerId } = await registerUser("Owner2", ownerEmail, "a-strong-password-123", "http://localhost");
    const { userId: viewerId } = await registerUser("Viewer2", viewerEmail, "a-strong-password-123", "http://localhost");
    const { rows: workspaceRows } = await db.query<{ workspace_id: string }>(
      `select workspace_id from workspace_members where user_id = $1 and role = 'owner'`,
      [ownerId]
    );
    const workspaceId = workspaceRows[0].workspace_id;

    mockUserId = ownerId;
    const project = await createProject({ name: "Role test project 2", accountId: workspaceId });
    await addProjectMember(project.id, viewerEmail);

    // Le owner garde un accès de gestion complet (contrôle négatif : ces
    // routes ne doivent pas être cassées pour qui a réellement le droit).
    const ownerGet = await getProjectRoute(new NextRequest("http://localhost"), params(project.id));
    expect((await ownerGet.json()).canManage).toBe(true);

    mockUserId = viewerId;

    const viewerGet = await getProjectRoute(new NextRequest("http://localhost"), params(project.id));
    expect(viewerGet.status).toBe(200);
    expect((await viewerGet.json()).canManage).toBe(false); // lecture OK, mais jamais gestion

    const patchRes = await patchProjectRoute(
      new NextRequest("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hacked" }),
      }),
      params(project.id)
    );
    expect(patchRes.status).toBe(403);

    const deleteRes = await deleteProjectRoute(new NextRequest("http://localhost", { method: "DELETE" }), params(project.id));
    expect(deleteRes.status).toBe(403);

    const refreshRes = await refreshPost(new NextRequest("http://localhost", { method: "POST" }), params(project.id));
    expect(refreshRes.status).toBe(403);

    const connectRes = await connectBigQueryPost(
      new NextRequest("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gcpProjectId: "attacker-project", ga4Dataset: "whatever" }),
      }),
      params(project.id)
    );
    expect(connectRes.status).toBe(403);

    const gcpProjectsRes = await gcpProjectsGet(new NextRequest("http://localhost"), params(project.id));
    expect(gcpProjectsRes.status).toBe(403);

    const gcpDatasetsRes = await gcpDatasetsGet(
      new NextRequest(`http://localhost?gcpProjectId=attacker-project`),
      params(project.id)
    );
    expect(gcpDatasetsRes.status).toBe(403);

    const customModelViewerRes = await customModelPut(
      customModelPutRequest({ firstTouchPercent: 50, middlePercent: 0, lastTouchPercent: 50, rules: [] }),
      params(project.id)
    );
    expect(customModelViewerRes.status).toBe(403);

    const sheetExportViewerRes = await sheetExportPut(
      jsonPutRequest({ url: "https://docs.google.com/spreadsheets/d/abc123/edit" }),
      params(project.id)
    );
    expect(sheetExportViewerRes.status).toBe(403);

    mockUserId = null;
    await db.query(`delete from projects where id = $1`, [project.id]);
    await db.query(`delete from workspaces where id = $1`, [workspaceId]);
    await db.query(`delete from users where email in ($1, $2)`, [ownerEmail, viewerEmail]);
  });

  it("custom-model route: zod rejects a body that doesn't sum to 100, the owner can save/clear it, and getCustomModelConfig round-trips null -> populated -> null", async () => {
    const db = getDbPool();
    const ownerEmail = `role-test-owner3-${RUN_ID}@attribmaster.dev`;
    const { userId: ownerId } = await registerUser("Owner3", ownerEmail, "a-strong-password-123", "http://localhost");
    const { rows: workspaceRows } = await db.query<{ workspace_id: string }>(
      `select workspace_id from workspace_members where user_id = $1 and role = 'owner'`,
      [ownerId]
    );
    const workspaceId = workspaceRows[0].workspace_id;

    mockUserId = ownerId;
    const project = await createProject({ name: "Role test project 3", accountId: workspaceId });

    const freshAccess = await getProjectWithAccess(project.id);
    expect(getCustomModelConfig(freshAccess!.project)).toBeNull();

    const invalidRes = await customModelPut(
      customModelPutRequest({ firstTouchPercent: 50, middlePercent: 10, lastTouchPercent: 10, rules: [] }), // somme = 70
      params(project.id)
    );
    expect(invalidRes.status).toBe(400);

    const invalidRulesSumRes = await customModelPut(
      customModelPutRequest({
        firstTouchPercent: 60,
        middlePercent: 15,
        lastTouchPercent: 25,
        rules: [
          { channelValue: "google / cpc", position: "first", percent: 70 },
          { channelValue: "direct / none", position: "last", percent: 40 },
        ], // somme des règles = 110 > 100
      }),
      params(project.id)
    );
    expect(invalidRulesSumRes.status).toBe(400);

    const validRes = await customModelPut(
      customModelPutRequest({
        firstTouchPercent: 60,
        middlePercent: 15,
        lastTouchPercent: 25,
        rules: [{ channelValue: "google / cpc", position: "first", percent: 70 }],
      }),
      params(project.id)
    );
    expect(validRes.status).toBe(200);
    const validJson = await validRes.json();
    expect(validJson.config).toEqual({
      firstTouchPercent: 60,
      middlePercent: 15,
      lastTouchPercent: 25,
      rules: [{ channelValue: "google / cpc", position: "first", percent: 70 }],
    });

    const afterSaveAccess = await getProjectWithAccess(project.id);
    expect(getCustomModelConfig(afterSaveAccess!.project)).toEqual({
      firstTouchPercent: 60,
      middlePercent: 15,
      lastTouchPercent: 25,
      rules: [{ channelValue: "google / cpc", position: "first", percent: 70 }],
    });

    const clearRes = await customModelDelete(new NextRequest("http://localhost", { method: "DELETE" }), params(project.id));
    expect(clearRes.status).toBe(200);
    const afterClearAccess = await getProjectWithAccess(project.id);
    expect(getCustomModelConfig(afterClearAccess!.project)).toBeNull();

    mockUserId = null;
    await db.query(`delete from projects where id = $1`, [project.id]);
    await db.query(`delete from workspaces where id = $1`, [workspaceId]);
    await db.query(`delete from users where email = $1`, [ownerEmail]);
  });

  it("google-sheet-export route: rejects a malformed URL, and rejects a valid URL when the project isn't connected to BigQuery yet", async () => {
    const db = getDbPool();
    const ownerEmail = `role-test-owner4-${RUN_ID}@attribmaster.dev`;
    const { userId: ownerId } = await registerUser("Owner4", ownerEmail, "a-strong-password-123", "http://localhost");
    const { rows: workspaceRows } = await db.query<{ workspace_id: string }>(
      `select workspace_id from workspace_members where user_id = $1 and role = 'owner'`,
      [ownerId]
    );
    const workspaceId = workspaceRows[0].workspace_id;

    mockUserId = ownerId;
    // Jamais connecté à BigQuery : createProject seule (étape 1) ne renseigne
    // aucun oauth_refresh_token_encrypted.
    const project = await createProject({ name: "Role test project 4", accountId: workspaceId });

    const malformedRes = await sheetExportPut(jsonPutRequest({ url: "not a url" }), params(project.id));
    expect(malformedRes.status).toBe(400);

    const notASheetRes = await sheetExportPut(
      jsonPutRequest({ url: "https://example.com/not-a-sheet" }),
      params(project.id)
    );
    expect(notASheetRes.status).toBe(400);

    // URL bien formée, mais le projet n'a pas encore de token OAuth (jamais
    // connecté à BigQuery) : rejeté avant même de tenter un appel Google.
    const notConnectedRes = await sheetExportPut(
      jsonPutRequest({ url: "https://docs.google.com/spreadsheets/d/abc123/edit" }),
      params(project.id)
    );
    expect(notConnectedRes.status).toBe(400);
    const notConnectedJson = await notConnectedRes.json();
    expect(notConnectedJson.error).toMatch(/BigQuery/);

    mockUserId = null;
    await db.query(`delete from projects where id = $1`, [project.id]);
    await db.query(`delete from workspaces where id = $1`, [workspaceId]);
    await db.query(`delete from users where email = $1`, [ownerEmail]);
  });

  it("the demo project (MOCK_PROJECT_ID) is read-only for EVERY authenticated user, including its own e2e-fixture owner", async () => {
    const email = `role-test-demo-${RUN_ID}@attribmaster.dev`;
    const { userId } = await registerUser("Demo Checker", email, "a-strong-password-123", "http://localhost");
    mockUserId = userId;

    const patchRes = await patchProjectRoute(
      new NextRequest("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hacked" }),
      }),
      params(MOCK_PROJECT_ID)
    );
    expect(patchRes.status).toBe(403);

    const refreshRes = await refreshPost(new NextRequest("http://localhost", { method: "POST" }), params(MOCK_PROJECT_ID));
    expect(refreshRes.status).toBe(403);

    const connectRes = await connectBigQueryPost(
      new NextRequest("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gcpProjectId: "attacker-project", ga4Dataset: "whatever" }),
      }),
      params(MOCK_PROJECT_ID)
    );
    expect(connectRes.status).toBe(403);

    const customModelRes = await customModelPut(
      customModelPutRequest({ firstTouchPercent: 50, middlePercent: 0, lastTouchPercent: 50, rules: [] }),
      params(MOCK_PROJECT_ID)
    );
    expect(customModelRes.status).toBe(403);

    const sheetExportRes = await sheetExportPut(
      jsonPutRequest({ url: "https://docs.google.com/spreadsheets/d/abc123/edit" }),
      params(MOCK_PROJECT_ID)
    );
    expect(sheetExportRes.status).toBe(403);

    // Mais la lecture reste bien accessible (c'est tout le principe du mode démo).
    const getRes = await getProjectRoute(new NextRequest("http://localhost"), params(MOCK_PROJECT_ID));
    expect(getRes.status).toBe(200);
    expect((await getRes.json()).canManage).toBe(false);

    mockUserId = null;
    const pool = getDbPool();
    await pool.query(`delete from workspaces where id in (
      select workspace_id from workspace_members wm
      join users u on u.id = wm.user_id where u.email = $1 and wm.role = 'owner')`, [email]);
    await pool.query(`delete from users where email = $1`, [email]);
  });
});
