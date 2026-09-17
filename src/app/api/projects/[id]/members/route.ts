import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/auth/errors";
import { addProjectMember, listPendingProjectMemberInvites, listProjectMembers } from "@/lib/projects/repository";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [members, invites] = await Promise.all([listProjectMembers(id), listPendingProjectMemberInvites(id)]);
    return NextResponse.json({ members, invites });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/members GET]", "Failed to load members");
  }
}

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await addProjectMember(id, parsed.data.email, request.nextUrl.origin);
    if (result.kind === "invited") {
      // 202 : pas d'accès accordé tout de suite, juste une invitation envoyée par email.
      return NextResponse.json({ invite: result.invite }, { status: 202 });
    }
    return NextResponse.json({ member: result.member });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/members POST]", "Failed to add member");
  }
}
