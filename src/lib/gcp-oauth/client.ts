import { OAuth2Client } from "google-auth-library";

// Scope complet BigQuery (lecture + jobs de requête, requis pour le script de
// nuit qui fait des DELETE/INSERT) + lecture des projets GCP accessibles
// (pour laisser choisir le projet sans le taper à la main).
const GCP_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/bigquery",
  "https://www.googleapis.com/auth/cloudplatformprojects.readonly",
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
