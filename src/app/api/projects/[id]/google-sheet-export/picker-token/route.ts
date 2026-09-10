import { NextRequest, NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/auth/errors";
import { mintAccessToken } from "@/lib/gcp-oauth/client";
import { getProjectOAuthToken, requireProjectAccess, requireUserId } from "@/lib/projects/repository";

/**
 * Jeton d'accès de courte durée (~1h), à remettre au sélecteur de fichiers
 * Google (Picker) côté navigateur — voir GoogleSheetPickerButton. Jamais le
 * refresh token lui-même. Réservé à la gestion du projet (même niveau que
 * PUT ci-dessus) : ce jeton, même éphémère, permet d'agir au nom du compte
 * Google connecté.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const userId = await requireUserId();
    await requireProjectAccess(id, userId);

    const refreshToken = await getProjectOAuthToken(id);
    if (!refreshToken) {
      return NextResponse.json(
        { error: "Connecte d'abord BigQuery sur ce projet avant de choisir une feuille." },
        { status: 400 }
      );
    }

    const accessToken = await mintAccessToken(refreshToken);
    return NextResponse.json({ accessToken });
  } catch (error) {
    return apiErrorResponse(
      error,
      "[api/projects/[id]/google-sheet-export/picker-token GET]",
      "Failed to mint picker access token"
    );
  }
}
