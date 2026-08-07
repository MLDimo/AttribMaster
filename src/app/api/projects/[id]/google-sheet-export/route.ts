import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/auth/errors";
import { parseSpreadsheetId, verifySheetAccess } from "@/lib/google-sheets/client";
import {
  clearGoogleSheetExportUrl,
  getProjectOAuthToken,
  requireProjectAccess,
  requireUserId,
  saveGoogleSheetExportUrl,
} from "@/lib/projects/repository";

const bodySchema = z
  .object({ url: z.string().trim().url() })
  .refine((data) => parseSpreadsheetId(data.url) !== null, {
    message: "URL Google Sheets invalide (format attendu : https://docs.google.com/spreadsheets/d/ID/edit)",
  });

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Vérification d'accès AVANT tout usage du token OAuth réel (même
    // discipline que connect-bigquery/gcp-projects/gcp-datasets) : jamais
    // d'appel Google avec le jeton d'un projet sans avoir d'abord confirmé
    // que l'appelant a le droit de le modifier.
    const userId = await requireUserId();
    await requireProjectAccess(id, userId);

    // `getProjectOAuthToken` renvoie null proprement si le projet n'a jamais
    // été connecté (rien à déchiffrer), mais lève si le déchiffrement d'un
    // jeton PRÉSENT échoue (jeton corrompu) — deux cas distincts, deux
    // messages différents, plutôt que de tout confondre sous "pas connecté".
    let refreshToken: string | null;
    try {
      refreshToken = await getProjectOAuthToken(id);
    } catch (error) {
      console.error("[api/google-sheet-export] failed to decrypt OAuth token", error);
      return NextResponse.json(
        {
          error:
            "La connexion Google de ce projet semble corrompue. Reconnecte BigQuery sur ce projet (Connexion BigQuery) puis réessaie.",
        },
        { status: 400 }
      );
    }
    if (!refreshToken) {
      return NextResponse.json(
        { error: "Connecte d'abord BigQuery sur ce projet avant de configurer l'export Google Sheets." },
        { status: 400 }
      );
    }

    const spreadsheetId = parseSpreadsheetId(parsed.data.url)!;
    try {
      await verifySheetAccess(refreshToken, spreadsheetId);
    } catch (error) {
      console.error("[api/google-sheet-export] verification failed", error);
      return NextResponse.json(
        {
          error:
            "Impossible d'accéder à cette feuille. Vérifie que l'URL est correcte et que tu as les droits d'édition dessus. Si l'export Google Sheets vient d'être activé, reconnecte ton compte Google sur ce projet (Connexion BigQuery) : le jeton existant n'a peut-être pas encore cette autorisation.",
        },
        { status: 400 }
      );
    }

    const project = await saveGoogleSheetExportUrl(id, parsed.data.url);
    return NextResponse.json({
      url: project.export_google_sheet_url,
      lastSyncedAt: project.export_google_sheet_last_synced_at,
      lastError: project.export_google_sheet_last_error,
    });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/google-sheet-export PUT]", "Failed to save Google Sheet export");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await clearGoogleSheetExportUrl(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "[api/projects/[id]/google-sheet-export DELETE]", "Failed to clear Google Sheet export");
  }
}
