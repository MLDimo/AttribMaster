# AttribMaster

SaaS d'attribution marketing multi-touch : connecte un export GA4 → BigQuery et calcule l'attribution (linéaire, U-shape, time-decay) sur les transactions.

## Stack

- Next.js 16 (App Router) + Tailwind CSS v4
- Auth.js v5 : login email/mot de passe + Google OAuth
- Vercel Postgres / Neon : comptes, workspaces, projets
- Google BigQuery : connexion OAuth par projet (1 projet = 1 dataset GA4), refresh token chiffré (AES-256-GCM)
- Script d'attribution nocturne (`sql/nightly_attribution.sql`, cron Vercel à 2h, voir `vercel.json`)

## Démarrer en local

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000). Les variables d'environnement nécessaires sont documentées dans `.env` (non versionné).

## Structure

- `src/app` — pages et routes API (App Router)
- `src/components` — composants UI (`ui/` = shadcn, `dashboard/`, `layout/`, `effects/`)
- `src/lib` — logique métier (attribution, BigQuery, projets, comptes, crypto, OAuth GCP)
- `db/migrations` — schéma Postgres (Auth.js, workspaces/projects, mot de passe)
- `sql/` — DDL et script d'attribution BigQuery
- `scripts/seed-admin.mjs` — création d'un compte admin (email + mot de passe)

## Déploiement

Déployé sur Vercel. Voir `CLAUDE.md` pour la roadmap détaillée (V1 attribution, V2 multi-tenant, V3 facturation Stripe).
