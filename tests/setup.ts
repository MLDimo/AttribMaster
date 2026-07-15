import fs from "node:fs";
import path from "node:path";

// En local, charge .env.test (base preprod dédiée) s'il existe. En CI, les
// secrets sont déjà injectés comme variables d'environnement par le workflow
// GitHub Actions — ce fichier n'existe pas dans le runner, no-op.
const envTestPath = path.join(process.cwd(), ".env.test");
if (fs.existsSync(envTestPath)) {
  process.loadEnvFile(envTestPath);
}

// Garde-fou dur : la suite ne doit JAMAIS pouvoir écrire dans la base de
// production, quelle que soit la config présente au moment du run. On bloque
// tout de suite si DATABASE_URL pointe vers l'host de prod connu.
const PRODUCTION_DB_HOST_FRAGMENT = "ep-solitary-hall-asw709el";
const databaseUrl = process.env.DATABASE_URL ?? "";
if (databaseUrl.includes(PRODUCTION_DB_HOST_FRAGMENT)) {
  throw new Error(
    "DATABASE_URL pointe vers la base de PRODUCTION. Les tests doivent tourner " +
      "uniquement contre la base preprod — vérifie .env.test ou les secrets CI."
  );
}

// Même garde-fou côté Stripe : jamais de clé live dans la suite de tests.
const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
if (stripeKey.startsWith("sk_live_")) {
  throw new Error(
    "STRIPE_SECRET_KEY est une clé LIVE. Les tests doivent utiliser une clé " +
      "sk_test_ uniquement — vérifie .env.test ou les secrets CI."
  );
}
