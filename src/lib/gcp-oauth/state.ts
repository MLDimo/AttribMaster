import crypto from "node:crypto";

/**
 * Anti-CSRF du flux OAuth Google : le `state` transporte projectId + un nonce
 * aléatoire, dont une copie est posée en cookie httpOnly avant la redirection
 * vers Google. Au callback, cookie et state doivent correspondre — sinon un
 * lien piégé pourrait faire enregistrer le refresh token d'un attaquant sur
 * le projet d'une victime authentifiée.
 */
export const OAUTH_STATE_COOKIE = "gcp_oauth_nonce";

export function createOAuthNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function packOAuthState(projectId: string, nonce: string): string {
  return `${projectId}:${nonce}`;
}

export function parseOAuthState(state: string): { projectId: string; nonce: string } | null {
  const separator = state.indexOf(":");
  if (separator <= 0 || separator === state.length - 1) return null;
  return { projectId: state.slice(0, separator), nonce: state.slice(separator + 1) };
}

/** Comparaison en temps constant (les nonces ont une taille fixe connue). */
export function isValidNonce(fromState: string, fromCookie: string | undefined): boolean {
  if (!fromCookie || fromState.length !== fromCookie.length) return false;
  return crypto.timingSafeEqual(Buffer.from(fromState), Buffer.from(fromCookie));
}
