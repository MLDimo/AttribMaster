import * as Sentry from "@sentry/nextjs";

/**
 * Monitoring d'erreurs serveur (les console.error des logs Vercel expirent en
 * quelques heures sur le plan Hobby). Activé uniquement si SENTRY_DSN est
 * défini — no-op complet sinon, y compris en local et en CI.
 */
export async function register() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? "development",
      // Pas de tracing/replay : on ne veut que les erreurs (quota gratuit).
      tracesSampleRate: 0,
    });
  }
}

/** Capture les erreurs non gérées des routes/pages (App Router). */
export const onRequestError = Sentry.captureRequestError;
