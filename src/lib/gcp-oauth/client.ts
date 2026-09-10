import { OAuth2Client } from "google-auth-library";

// Scope complet BigQuery (lecture + jobs de requête, requis pour le script de
// nuit qui fait des DELETE/INSERT) + lecture des projets GCP accessibles
// (pour laisser choisir le projet sans le taper à la main) + écriture Google
// Sheets (export nocturne, voir lib/google-sheets/client.ts).
//
// `drive.file`, pas `spreadsheets` : à la demande de l'équipe de vérification
// OAuth de Google, qui pousse systématiquement vers le scope le plus étroit
// possible. `drive.file` ne donne accès qu'aux fichiers créés par l'app ou
// explicitement ouverts par l'utilisateur via le sélecteur Google (Picker,
// voir GoogleSheetPickerButton) — jamais à un fichier identifié seulement par
// une URL collée. Le champ "coller une URL" a donc été remplacé par ce
// sélecteur (voir google-sheet-export-settings.tsx) : sans lui, ce scope ne
// suffit à rien.
//
// Scope changé le 2026-09 (était `spreadsheets` avant, ajouté puis retiré
// après la première vérification Google) : les projets déjà connectés
// doivent se reconnecter ET re-choisir leur feuille via le Picker — un jeton
// existant, même après reconnexion, ne donne accès à AUCUN fichier tant que
// celui-ci n'a pas été sélectionné une fois via ce mécanisme.
const GCP_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/bigquery",
  "https://www.googleapis.com/auth/cloudplatformprojects.readonly",
  "https://www.googleapis.com/auth/drive.file",
];

function getOAuthRedirectUri(origin: string): string {
  return `${origin}/api/gcp-oauth/callback`;
}

function createOAuthClient(redirectUri: string): OAuth2Client {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  });
}

export function buildConsentUrl(origin: string, state: string): string {
  const client = createOAuthClient(getOAuthRedirectUri(origin));
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GCP_OAUTH_SCOPES,
    state,
  });
}

export async function exchangeCodeForRefreshToken(
  origin: string,
  code: string
): Promise<string> {
  const client = createOAuthClient(getOAuthRedirectUri(origin));
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token returned by Google (the user may have already granted consent without 'prompt=consent')"
    );
  }
  return tokens.refresh_token;
}

/** Client OAuth prêt à requêter l'API Google (BigQuery, Resource Manager) pour un projet donné. */
export function authorizedClientFromRefreshToken(refreshToken: string): OAuth2Client {
  const client = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

/**
 * Échange le refresh token contre un access token de courte durée (~1h), à
 * remettre au Picker Google côté navigateur (`setOAuthToken`) — jamais le
 * refresh token lui-même, qui reste toujours côté serveur. Le Picker en a
 * besoin pour que l'utilisateur choisisse un fichier SOUS SON PROPRE compte
 * Google, celui déjà connecté à ce projet.
 */
export async function mintAccessToken(refreshToken: string): Promise<string> {
  const client = authorizedClientFromRefreshToken(refreshToken);
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error("Google n'a renvoyé aucun access token pour ce refresh token");
  }
  return token;
}

/**
 * Numéro de projet Cloud (préfixe numérique d'un client ID OAuth Google,
 * ex: "565818019661-abc123.apps.googleusercontent.com" -> "565818019661"),
 * requis par `PickerBuilder.setAppId` pour le scope `drive.file`.
 *
 * Sans lui, le Picker s'ouvre et laisse choisir un fichier normalement, mais
 * Drive n'enregistre JAMAIS l'autorisation par fichier qu'exige `drive.file`
 * — bug vécu en prod : sélection réussie côté Picker, puis 404 "Requested
 * entity was not found" à la moindre requête serveur ensuite, alors que le
 * jeton porte bien le scope et que l'ID de fichier extrait est le bon. Le
 * scope OAuth seul identifie QUI demande l'accès ; `setAppId` identifie à
 * QUEL PROJET CLOUD l'accorder — Picker a besoin des deux pour `drive.file`.
 */
export function googleCloudProjectNumber(): string | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  return clientId?.split("-")[0] || null;
}
