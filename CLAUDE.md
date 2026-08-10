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
  (jointures `workspace_members`/`project_members`), pas de RLS. Deux niveaux :
  `hasProjectManageAccess`/`requireProjectAccess` (owner/admin du workspace — seul
  niveau habilité à modifier quoi que ce soit) et simple accès en lecture (owner/admin
  OU ligne directe dans `project_members`, sans rôle de gestion — c'est le rôle
  "collaborateur lecture seule" pour partager avec un client/stagiaire sans risque).
  `getProjectWithAccess` combine les deux pour l'UI (`canManage`).
- `lib/attribution/models.ts` — 6 modèles (last click, linéaire, croissant, en U,
  Markov par effet de suppression, Shapley : exact ≤12 canaux, Monte Carlo au-delà)
- `lib/attribution/queue.ts` — file `nightly_jobs` (claim atomique SKIP LOCKED) :
  cron nocturne avec fenêtre de rattrapage 3 jours (l'export GA4→BigQuery peut
  prendre 72h), refresh manuel, backfill historique complet à la connexion BigQuery.
  `classifyNightlyFailure` distingue la panne de facturation GCP des autres :
  sans compte de facturation actif le projet client repasse en **sandbox
  BigQuery**, où les SELECT passent mais où toute écriture est refusée (DML du
  script de nuit ET `tables.patch` du schéma). Le conseil générique "vérifie ta
  connexion BigQuery" est alors une fausse piste — d'où un bandeau dédié
  (`DataFreshnessBanner`) pointant vers la facturation du bon projet GCP.
- `lib/attribution/mock-data.ts` — projet démo public `MOCK_PROJECT_ID` (données
  déterministes mais relatives à "maintenant"), court-circuite BigQuery mais PAS
  l'auth : accessible en lecture seule à tout utilisateur connecté (bouton "Explorer
  une démo" sur `/projects`), jamais aux visiteurs anonymes. `getProject` le
  reconnaît par égalité d'ID et renvoie des métadonnées virtuelles sans lecture DB.
- `sql/nightly_attribution.sql` — script BigQuery idempotent (DELETE+INSERT par jour)
- `lib/attribution/channel-performance.ts` — taux de conversion + panier moyen par
  canal (indépendants du modèle d'attribution). Dénominateur (sessions, TOUTES,
  pas seulement celles qui achètent) alimenté par `sql/nightly_channel_sessions.sql`
  dans la table résumée `sessions_par_canal` — `attributions_resumees` seule ne
  contient que des transactions déjà converties, jamais de dénominateur de
  conversion. Colonnes de ventilation optionnelles ("+" dans l'en-tête du
  tableau, `ChannelPerformanceBreakdown`) : Support/Campagne en plus de la
  dimension principale, chaque ajout subdivise réellement les lignes (une par
  combinaison canal × valeur ajoutée), jamais une valeur indicative.
- 7e modèle d'attribution "Personnalisé" (`AttributionModel = "custom"`) : un
  "En U" généralisé, un seul par projet, poids (premier/milieu/dernier contact,
  somme = 100) stockés en colonnes nullables `projects.custom_model_*` (jamais
  NULL séparément, contrainte DB). Gestion (lecture pour tous, écriture
  `hasProjectManageAccess` uniquement) via `PUT`/`DELETE
  /api/projects/[id]/custom-model`, calcul dans `models.ts` (`computeWeights`
  case "custom"), UI dans l'onglet "Mon modèle" du panneau `AttributionModelsGuide`.
  Règles conditionnelles optionnelles (`projects.custom_model_rules` jsonb) :
  "si le premier/dernier contact est CE canal, donne-lui X%" — ne peuvent
  cibler QUE premier/dernier (positions uniques par transaction, jamais le
  milieu qui peut en désigner 0/1/plusieurs). Le budget non consommé par les
  règles qui matchent une transaction donnée retombe sur le modèle par défaut
  au prorata, garantissant une somme toujours exacte à 100 % (voir
  `computeCustomWeights`) ; somme des règles ≤ 100 validée par zod uniquement
  (pas de contrainte DB sur le contenu du JSON).
- `lib/google-sheets/client.ts` — export nocturne vers Google Sheets (`/manage`,
  colonne `projects.export_google_sheet_url`) : réécrit chaque nuit un onglet
  dédié "AttribMaster" (créé automatiquement, jamais le premier onglet) avec
  les 90 derniers jours de transactions, best-effort comme les sessions par
  canal. Scope OAuth `spreadsheets` ajouté après la vérification Google
  initiale : les projets déjà connectés doivent se reconnecter une fois pour
  l'obtenir. Utilise `@googleapis/sheets` (pas `googleapis` — le paquet complet
  fait sortir `next build` en OOM) avec sa PROPRE copie de google-auth-library,
  non dédupliquée avec celle utilisée pour BigQuery (voir le commentaire dans
  le fichier) : jamais interchanger les `OAuth2Client` des deux paquets.
- Chaque transaction du dashboard est cliquable (`TransactionDetailDialog`) :
  ouvre le détail complet de chaque point de contact (source/support/campagne
  séparés, pas le libellé combiné, + `entry_url` = page d'atterrissage de la
  session, capturée dans `nightly_attribution.sql` depuis le premier
  `page_view`). Champ ajouté au STRUCT `touchpoints` de `attributions_resumees` ;
  `entry_url` reste `null` pour toute ligne calculée avant cet ajout.
- `runNightlyAttributionForProject` fait converger le schéma BigQuery avant
  d'insérer (`ensureNestedField`, idempotent) : un projet déjà connecté avant
  l'ajout d'un champ se met à jour tout seul à son prochain run nocturne, plus
  besoin d'un script ponctuel par client déjà connecté (contrairement à
  `sessions_par_canal`, qui lui avait eu besoin d'un tel script one-off).
  **Aucune syntaxe DDL n'ajoute un champ dans un STRUCT existant** (`ALTER
  TABLE ... ADD COLUMN touchpoints.entry_url` = erreur de syntaxe, bug vécu
  en prod) : il faut `tables.patch` via `table.setMetadata({ schema })`.

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
- **Mise en prod = PR `main`→`production`** via `gh pr create --base production --head main`
  puis `gh pr merge --auto --merge`. La branche `production` est protégée SANS bypass
  (push direct impossible, même admin) : le merge n'a lieu que si le check
  "Typecheck, lint, build, test" est vert. Auto-merge activé sur le repo.
- Toute modif de source nécessite `npm run build` avant `npx playwright test`
  (le webServer sert le bundle pré-buildé)

## Règles
1. Interdiction de requêter les tables brutes GA4 depuis l'UI : l'UI lit uniquement
   les tables résumées `attributions_resumees` et `sessions_par_canal` (via
   `/api/overview` et `/api/transactions`).
2. Jamais de clé de service GCP à saisir : OAuth uniquement, token chiffré en base.
3. Plan Vercel Hobby : pas de cron configurable par projet, `maxDuration` ≤ 300s.
4. Vouvoiement... non : le ton produit est au tutoiement (pages légales, erreurs).
