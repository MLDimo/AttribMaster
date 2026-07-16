import { NextRequest, NextResponse } from "next/server";

import { removeProjectMember } from "@/lib/projects/repository";
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
