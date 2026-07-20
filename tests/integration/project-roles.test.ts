import { afterAll, describe, expect, it, vi } from "vitest";

// Session mutable, lue dynamiquement par le mock @/auth : permet de rejouer
// createProject/addProjectMember/getProjectWithAccess "en tant que" owner
// puis viewer dans le même test, comme le ferait une vraie requête HTTP.
let mockUserId: string | null = null;
vi.mock("@/auth", () => ({ auth: vi.fn(async () => (mockUserId ? { user: { id: mockUserId } } : null)) }));

import { NotAuthorizedError } from "@/lib/auth/errors";
import { registerUser } from "@/lib/auth/registration";
import { getDbPool } from "@/lib/db/client";
import {
  addProjectMember,
  createProject,
  getProjectWithAccess,
  hasProjectManageAccess,
  requireProjectAccess,
} from "@/lib/projects/repository";

const RUN_ID = Date.now();
const OWNER_EMAIL = `role-test-owner-${RUN_ID}@attribmaster.dev`;
const VIEWER_EMAIL = `role-test-viewer-${RUN_ID}@attribmaster.dev`;

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
});
