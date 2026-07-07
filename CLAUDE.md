# Project: Attribution Tool SaaS (GA4 + BigQuery + Addingwell)

## Tech Stack
- **Database:** Vercel Postgres / Neon (`@neondatabase/serverless`)
- **Auth:** Auth.js / NextAuth v5 (Google OAuth, adaptateur `@auth/neon-adapter`)
- **Data Warehouse:** Google BigQuery (via SDK officiel `@google-cloud/bigquery`, connexion OAuth par projet)
- **Frontend:** Next.js (basé sur le repo ui-ux-pro-max-skill)
- **Paiement:** Stripe (Checkout + Customer Portal)

---

## 🚀 ROADMAP ÉVOLUTIVE

### 🎯 V1 : Le Cœur du Produit (Le script & L'affichage de base)
*Objectif : Avoir un outil fonctionnel où l'on peut connecter UN BigQuery et voir les graphiques d'attribution sans fioritures (pas encore de multi-compte ni de paiement).*

- [ ] **Data Model V1 :** Créer une table temporaire locale ou configurer directement la connexion à BigQuery avec un fichier JSON de clé GCP unique en local (`.env`).
- [ ] **Le Moteur d'Attribution (Le Script de nuit) :**
  - [ ] Écrire la requête SQL BigQuery incrémentale (partitionnée par date) pour extraire l'événement `purchase` de la veille.
  - [ ] Coder la logique pour remonter le fil des sessions (`user_pseudo_id`) et reconstruire la chaîne textuelle des sources (ex: `Google / cpc > Direct`).
  - [ ] Insérer ces données dans la table BigQuery `attributions_resumees`.
- [ ] **L'API d'Attribution V1 :**
  - [ ] Implémenter les 3 algorithmes de calcul (Linéaire, U-Shape, Time-Decay).
  - [ ] Créer l'endpoint `/api/overview` (Totaux globaux, top sources en % et gestion du comparatif de dates N-1).
  - [ ] Créer l'endpoint `/api/transactions` (Liste, recherche par ID, pagination et tri par valeur).
- [ ] **L'Interface UI V1 :**
  - [ ] Intégrer le dashboard du repo `ui-ux-pro-max-skill`.
  - [ ] Connecter le graphique principal avec le code couleur par source + légende.
  - [ ] Connecter le tableau de la liste détaillée des transactions.

---

### 👥 V2 : Le SaaS Multi-Tenant & Sécurité (Comptes & 2FA)
*Objectif : Transformer l'outil en plateforme où n'importe qui peut s'inscrire via Google, créer son espace et ajouter plusieurs projets (1 projet = 1 BigQuery séparé).*

- [ ] **Data Model V2 (Postgres/Neon) :** Créer les tables `users`/`accounts`/`sessions` (Auth.js), `workspaces`, `workspace_members`, `projects`, `workspace_projects`.
- [ ] **Authentification & Onboarding :**
  - [ ] Configurer le bouton "Se connecter avec Google" (Google OAuth via Auth.js).
  - [ ] Écrire le trigger Postgres pour créer automatiquement un workspace par défaut au premier login.
  - [ ] Intégrer et forcer l'activation de la 2FA (TOTP maison, pas de solution native) pour sécuriser l'accès aux projets.
- [ ] **Gestion des Projets :**
  - [ ] Connexion BigQuery par OAuth Google (pas de clé JSON à saisir) ; refresh token chiffré (AES-256-GCM) en base.
  - [ ] Pas de RLS (pas de couche PostgREST/JWT côté DB) : autorisation vérifiée explicitement dans le code applicatif (jointures `workspace_members` à chaque requête).
  - [ ] Adapter l'API et le Script de nuit pour boucler sur chaque projet actif de la base.

---

### 💳 V3 : Monétisation & Autonomie (Stripe)
*Objectif : Rendre le projet rentable et automatisé. Verrouiller les accès selon le statut du paiement.*

- [ ] **Intégration Stripe Checkout :** Créer le bouton d'abonnement qui ouvre la page de paiement Stripe liée à l'ID de l'`account`.
- [ ] **Intégration Stripe Customer Portal :** Permettre au client de gérer ses factures et son abonnement en un clic.
- [ ] **Gestion des Webhooks :** Coder le webhook Stripe pour mettre à jour instantanément le statut de l'abonnement en base.
- [ ] **Middleware de Restriction :** Bloquer l'accès aux dashboards V1/V2 si le statut de l'abonnement du compte n'est pas `active` ou `trialing`.

---

## Development Guidelines (Strict)
1. **Focus V1 First :** Ne pas écrire une seule ligne de code concernant Stripe ou la gestion de compte tant que les cases de la V1 ne sont pas toutes cochées `[x]`.
2. **BigQuery Optimization :** Interdiction stricte de requêter les tables brutes de GA4 depuis l'interface utilisateur. L'UI interroge uniquement la table résumée.
