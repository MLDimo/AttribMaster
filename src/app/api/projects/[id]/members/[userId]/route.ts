import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  ProjectMemberNotFoundError,
  removeProjectMember,
  updateProjectMemberRole,
} from "@/lib/projects/repository";
import { apiErrorResponse } from "@/lib/auth/errors";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId } = await params;
  try {
    await removeProjectMember(id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/members/[userId] DELETE]", "Failed to remove member");
  }
}

const roleBodySchema = z.object({
  role: z.enum(["read", "owner"]),
});

/** Réservé owner/admin du projet : promeut/rétrograde un collaborateur direct entre "lecture" et "owner". */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = roleBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const member = await updateProjectMemberRole(id, userId, parsed.data.role);
    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof ProjectMemberNotFoundError) {
      return NextResponse.json({ error: "Ce collaborateur n'existe pas sur ce projet." }, { status: 404 });
    }
    return apiErrorResponse(error, "[api/projects/[id]/members/[userId] PATCH]", "Failed to update member role");
  }
}
