import { NextRequest, NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/auth/errors";
import { cancelProjectMemberInvite } from "@/lib/projects/repository";

/** Annule une invitation en attente (collaborateur pas encore inscrit). Réservé owner/admin du projet. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; email: string }> }
) {
  const { id, email } = await params;
  try {
    // Next.js décode déjà le segment dynamique : `email` est ici en clair (ex: "a@b.com").
    await cancelProjectMemberInvite(id, email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/invites/[email] DELETE]", "Failed to cancel invite");
  }
}
