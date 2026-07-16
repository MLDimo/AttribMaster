import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/auth/errors";
import {
  addProjectMember,
  listProjectMembers,
  ProjectMemberUserNotFoundError,
} from "@/lib/projects/repository";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const members = await listProjectMembers(id);
    return NextResponse.json({ members });
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
    const member = await addProjectMember(id, parsed.data.email);
    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof ProjectMemberUserNotFoundError) {
      return NextResponse.json(
        { error: "Aucun compte AttribMaster n'existe avec cet email." },
        { status: 404 }
      );
    }
    if (error instanceof Error && error.message === "Not authorized on this project") {
      return NextResponse.json({ error: "Tu n'as pas les droits pour gérer ce projet." }, { status: 403 });
    }
    return apiErrorResponse(error, "[api/projects/[id]/members POST]", "Failed to add member");
  }
}
