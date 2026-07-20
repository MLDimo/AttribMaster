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

    mockUserId = null;
    await db.query(`delete from projects where id = $1`, [project.id]);
    await db.query(`delete from workspaces where id = $1`, [workspaceId]);
    await db.query(`delete from users where email in ($1, $2)`, [ownerEmail, viewerEmail]);
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
