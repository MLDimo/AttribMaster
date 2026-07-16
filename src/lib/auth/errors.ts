import { NextResponse } from "next/server";

/** Levée par requireUserId & co quand aucune session n'est présente. */
export class UnauthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthenticatedError";
  }
}

/**
 * Levée par les repositories quand l'utilisateur connecté n'a pas les droits
 * (owner/admin) sur la ressource visée (projet, workspace, account).
 */
export class NotAuthorizedError extends Error {
  constructor(resource: string) {
    super(`Not authorized on this ${resource}`);
    this.name = "NotAuthorizedError";
  }
}

/**
 * Réponse d'erreur standard des routes API : 401 si l'échec vient de
 * l'absence de session (au lieu d'un 500 trompeur qui pollue les logs à
 * chaque passage de bot non authentifié), 403 si la session existe mais n'a
 * pas les droits, 500 loggé sinon.
 */
export function apiErrorResponse(error: unknown, label: string, fallbackMessage: string) {
  if (error instanceof UnauthenticatedError) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (error instanceof NotAuthorizedError) {
    return NextResponse.json(
      { error: "Tu n'as pas les droits pour effectuer cette action." },
      { status: 403 }
    );
  }
  console.error(label, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
