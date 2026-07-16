import { NextResponse } from "next/server";

/** Levée par requireUserId & co quand aucune session n'est présente. */
export class UnauthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthenticatedError";
  }
}

/**
 * Réponse d'erreur standard des routes API : 401 si l'échec vient de
 * l'absence de session (au lieu d'un 500 trompeur qui pollue les logs à
 * chaque passage de bot non authentifié), 500 loggé sinon.
 */
export function apiErrorResponse(error: unknown, label: string, fallbackMessage: string) {
  if (error instanceof UnauthenticatedError) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error(label, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
