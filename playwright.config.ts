import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// En local, charge .env.test (base preprod dédiée) explicitement. Sans ça,
// `next start` chargerait le vrai .env (PRODUCTION) — Next.js ne remplace
// jamais une variable déjà présente dans process.env, donc l'injecter ici
// avant de spawn le serveur garantit qu'il ne peut jamais toucher la prod.
// En CI, les secrets sont déjà dans process.env, ce fichier n'existe pas.
const envTestPath = path.join(__dirname, ".env.test");
if (fs.existsSync(envTestPath)) {
  process.loadEnvFile(envTestPath);
}

const PRODUCTION_DB_HOST_FRAGMENT = "ep-solitary-hall-asw709el";
if ((process.env.DATABASE_URL ?? "").includes(PRODUCTION_DB_HOST_FRAGMENT)) {
  throw new Error(
    "DATABASE_URL pointe vers la base de PRODUCTION. Les tests e2e doivent tourner " +
      "uniquement contre la base preprod — vérifie .env.test ou les secrets CI."
  );
}

const serverEnv = {
  ...process.env,
  NEXT_PUBLIC_APP_URL: BASE_URL,
  AUTH_TRUST_HOST: "true",
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID ?? "ci-placeholder",
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET ?? "ci-placeholder",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "ci-placeholder",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "ci-placeholder",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60000,
    env: serverEnv,
  },
});
