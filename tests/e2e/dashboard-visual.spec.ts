import { expect, test } from "@playwright/test";

import { MOCK_PROJECT_ID } from "@/lib/attribution/mock-data";
import { seedE2EFixtures } from "./fixtures";
import { loginAsE2EUser } from "./login";

test.beforeAll(async () => {
  await seedE2EFixtures();
});

test.beforeEach(async ({ page }) => {
  await loginAsE2EUser(page);
});

test("visual regression: project dashboard layout (dynamic data masked)", async ({ page }) => {
  test.slow(); // première requête après un cold start Neon possible, laisse de la marge
  await page.goto(`/projects/${MOCK_PROJECT_ID}`);
  // Les données mock ("Project mockdata") sont générées avec des dates
  // relatives à "maintenant" (voir mock-data.ts) : le montant exact affiché
  // dans la fenêtre par défaut change donc de jour en jour. On masque les
  // zones dynamiques (chiffres, graphique, tableau) et on ne compare que la
  // mise en page/le style, stables par construction.
  await page.waitForSelector('[data-testid="overview-cards"]', { timeout: 45000 });
  await page.waitForTimeout(1500);

  await expect(page).toHaveScreenshot("dashboard-layout.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
    animations: "disabled",
    mask: [
      page.getByTestId("overview-cards"),
      page.getByTestId("attribution-chart"),
      page.getByTestId("transactions-table"),
    ],
  });
});

test("dashboard renders real numbers for the mockdata project (functional smoke check)", async ({ page }) => {
  test.slow();
  await page.goto(`/projects/${MOCK_PROJECT_ID}`);
  await page.waitForSelector('[data-testid="overview-cards"]', { timeout: 45000 });
  await page.waitForTimeout(1500);

  // Pas de diff pixel ici — juste une garantie fonctionnelle que le projet
  // mock affiche bien des vraies données (pas un état vide/cassé), peu
  // importe la date du run.
  await expect(page.getByText("Revenu attribué")).toBeVisible();
  const transactionsCount = await page.getByTestId("transactions-table").getByText(/transaction\(s\)/).textContent();
  expect(Number(transactionsCount?.match(/\d+/)?.[0] ?? 0)).toBeGreaterThan(0);
});
