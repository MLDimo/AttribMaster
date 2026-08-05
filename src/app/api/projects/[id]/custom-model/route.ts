import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCustomModelConfig } from "@/lib/projects/types";
import { clearCustomModelConfig, saveCustomModelConfig } from "@/lib/projects/repository";
import { apiErrorResponse } from "@/lib/auth/errors";

const bodySchema = z
  .object({
    firstTouchPercent: z.number().int().min(0).max(100),
    middlePercent: z.number().int().min(0).max(100),
    lastTouchPercent: z.number().int().min(0).max(100),
  })
  .refine((data) => data.firstTouchPercent + data.middlePercent + data.lastTouchPercent === 100, {
    message: "Les 3 parts doivent sommer à 100 %",
  });

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const project = await saveCustomModelConfig(id, parsed.data);
    return NextResponse.json({ config: getCustomModelConfig(project) });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/custom-model PUT]", "Failed to save custom model");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await clearCustomModelConfig(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/custom-model DELETE]", "Failed to clear custom model");
  }
}
