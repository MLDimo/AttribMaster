import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createProject, listAccessibleProjects } from "@/lib/projects/repository";

export async function GET() {
  try {
    const projects = await listAccessibleProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("[api/projects GET]", error);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  accountId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const project = await createProject(parsed.data);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("[api/projects POST]", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
