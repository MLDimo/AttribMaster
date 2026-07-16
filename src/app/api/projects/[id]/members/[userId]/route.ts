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
    if (error instanceof Error && error.message === "Not authorized on this project") {
      return NextResponse.json({ error: "Tu n'as pas les droits pour gérer ce projet." }, { status: 403 });
    }
    return apiErrorResponse(error, "[api/projects/[id]/members/[userId] DELETE]", "Failed to remove member");
  }
}
