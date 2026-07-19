import { expect, test } from "@playwright/test";

// Pages publiques, 100% statiques (aucune donnée datée) : baselines stables,
// aucune raison de changer d'un run à l'autre sauf régression réelle.
const STATIC_PAGES = [
  { name: "home", path: "/" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "reset-password", path: "/reset-password" },
  { name: "cgu", path: "/cgu" },
  { name: "cgv", path: "/cgv" },
  { name: "mentions-legales", path: "/mentions-legales" },
  { name: "politique-de-confidentialite", path: "/politique-de-confidentialite" },
];

for (const { name, path } of STATIC_PAGES) {
  test(`visual regression: ${name}`, async ({ page }) => {
    await page.goto(path);
    // Laisse les animations d'entrée (Framer Motion) se stabiliser avant la capture.
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    });
  });
}
