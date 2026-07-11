import { NextRequest, NextResponse } from "next/server";

import { removeProjectMember } from "@/lib/projects/repository";

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
    console.error("[api/projects/[id]/members/[userId] DELETE]", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
