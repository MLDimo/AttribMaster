import * as Sentry from "@sentry/nextjs";

// Erreurs côté navigateur. Même principe que src/instrumentation.ts : actif
// uniquement si la variable NEXT_PUBLIC_SENTRY_DSN existe au build.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    tracesSampleRate: 0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
