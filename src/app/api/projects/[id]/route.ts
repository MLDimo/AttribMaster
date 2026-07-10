import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { deleteProject, getProject, renameProject } from "@/lib/projects/repository";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found or not accessible" }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (error) {
    console.error("[api/projects/[id] GET]", error);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(1),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const project = await renameProject(id, parsed.data.name);
    return NextResponse.json({ project });
  } catch (error) {
    console.error("[api/projects/[id] PATCH]", error);
    return NextResponse.json({ error: "Failed to rename project" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/projects/[id] DELETE]", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
