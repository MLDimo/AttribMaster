import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCustomModelConfig } from "@/lib/projects/types";
import { clearCustomModelConfig, saveCustomModelConfig } from "@/lib/projects/repository";
import { apiErrorResponse } from "@/lib/auth/errors";

const ruleSchema = z.object({
  channelValue: z.string().trim().min(1).max(200),
  position: z.enum(["first", "last"]),
  percent: z.number().int().min(0).max(100),
});

const bodySchema = z
  .object({
    firstTouchPercent: z.number().int().min(0).max(100),
    middlePercent: z.number().int().min(0).max(100),
    lastTouchPercent: z.number().int().min(0).max(100),
    // Capé à 20 : une "carte de règles" n'a pas vocation à devenir une liste
    // sans fin — au-delà, le modèle par défaut premier/milieu/dernier reste
    // le bon outil pour le volume.
    rules: z.array(ruleSchema).max(20),
  })
  .refine((data) => data.firstTouchPercent + data.middlePercent + data.lastTouchPercent === 100, {
    message: "Les 3 parts par défaut doivent sommer à 100 %",
  })
  .refine((data) => data.rules.reduce((sum, r) => sum + r.percent, 0) <= 100, {
    message: "La somme des règles ne peut pas dépasser 100 %",
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
