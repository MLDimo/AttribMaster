# AttribMaster — SaaS d'attribution marketing (GA4 + BigQuery)

Multi-tenant, en production sur https://attribmaster.com. V1 (moteur d'attribution),
V2 (multi-tenant) et V3 (Stripe) de la roadmap initiale sont livrées. La 2FA
(TOTP) envisagée à l'origine n'a pas été implémentée.

## Stack
- **Next.js 16** (App Router, Turbopack), TypeScript strict, Tailwind v4, shadcn/ui, Framer Motion
- **DB :** Neon Postgres (`@neondatabase/serverless`), migrations SQL idempotentes dans `db/migrations/`
- **Auth :** Auth.js/NextAuth v5 (Google OAuth + Credentials, sessions JWT), proxy d'auth dans `src/proxy.ts`
- **BigQuery :** SDK officiel, connexion OAuth par projet (refresh token chiffré AES-256-GCM en base)
- **Paiement :** Stripe Checkout + Customer Portal + webhooks signés

## Architecture (src/)
- `app/api/` — routes API ; erreurs via `apiErrorResponse` (`lib/auth/errors.ts`) :
  `UnauthenticatedError` → 401, `NotAuthorizedError` → 403, reste → 500 loggé
- `lib/projects/repository.ts` — accès projets ; autorisation vérifiée dans le code
  (jointures `workspace_members`/`project_members`), pas de RLS
- `lib/attribution/models.ts` — 6 modèles (last click, linéaire, croissant, en U,
  Markov par effet de suppression, Shapley : exact ≤12 canaux, Monte Carlo au-delà)
- `lib/attribution/queue.ts` — file `nightly_jobs` (claim atomique SKIP LOCKED) :
  cron nocturne avec fenêtre de rattrapage 3 jours (l'export GA4→BigQuery peut
  prendre 72h), refresh manuel, backfill historique complet à la connexion BigQuery
- `lib/attribution/mock-data.ts` — projet démo `MOCK_PROJECT_ID` (données
  déterministes mais relatives à "maintenant"), court-circuite BigQuery et l'auth
- `sql/nightly_attribution.sql` — script BigQuery idempotent (DELETE+INSERT par jour)

## Environnements
- **Prod :** branche `production` → attribmaster.com (+ attrib-master.vercel.app)
- **Preprod :** branche `main` → previews Vercel (`attrib-master-git-main-*`)
- **Deux bases Neon distinctes** : `.env` local pointe la PROD (scripts admin
  uniquement) ; `.env.test` pointe la base preprod dédiée aux tests. Les tests
  refusent de tourner si `DATABASE_URL` contient l'hôte de prod (guards dans
  `tests/setup.ts` et `playwright.config.ts`).

## Tests & mise en prod
- `npm run test` — Vitest (unit + intégration : DB réelle preprod, Stripe test-mode réel)
- `npm run test:e2e` — Playwright (régression visuelle ; baselines darwin + linux,
  les baselines linux se régénèrent via Docker `mcr.microsoft.com/playwright`)
- CI GitHub Actions (`.github/workflows/ci.yml`) sur PR→production et push main/production ;
  secrets `TEST_*` dans le repo GitHub
- **Mise en prod = push `main:production`** (fast-forward), uniquement si CI verte.
  Toute modif de source nécessite `npm run build` avant `npx playwright test`
  (le webServer sert le bundle pré-buildé)

## Règles
1. Interdiction de requêter les tables brutes GA4 depuis l'UI : l'UI lit uniquement
   la table résumée `attributions_resumees` (via `/api/overview` et `/api/transactions`).
2. Jamais de clé de service GCP à saisir : OAuth uniquement, token chiffré en base.
3. Plan Vercel Hobby : pas de cron configurable par projet, `maxDuration` ≤ 300s.
4. Vouvoiement... non : le ton produit est au tutoiement (pages légales, erreurs).
