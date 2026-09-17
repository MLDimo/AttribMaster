import { describe, expect, it } from "vitest";

import { renderEmailButton, renderEmailLayout } from "./template";

describe("renderEmailLayout", () => {
  it("affiche le nom du site et reprend les couleurs de marque en mode jour (globals.css :root)", () => {
    const html = renderEmailLayout("<p>contenu</p>");
    expect(html).toContain("AttribMaster");
    // Couleurs du thème clair uniquement (--background, --card, --primary,
    // --brand-accent) : un email ne suit jamais le thème sombre du destinataire.
    expect(html).toContain("#faf5ee"); // --background
    expect(html).toContain("#fffdf9"); // --card
    expect(html).toContain("#8a4b2e"); // --primary
    expect(html).toContain("#c08a3e"); // --brand-accent
    expect(html).not.toContain("#1c140d"); // --background (dark)
  });

  it("insère le contenu fourni tel quel", () => {
    const html = renderEmailLayout("<p>Bonjour Martin</p>");
    expect(html).toContain("<p>Bonjour Martin</p>");
  });

  it("ajoute le preheader caché quand fourni, l'omet sinon", () => {
    expect(renderEmailLayout("<p>x</p>", "Aperçu caché")).toContain("Aperçu caché");
    expect(renderEmailLayout("<p>x</p>")).not.toContain("display:none");
  });

  it("reste un document HTML complet (utilisable tel quel comme corps d'email)", () => {
    const html = renderEmailLayout("<p>x</p>");
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });
});

describe("renderEmailButton", () => {
  it("génère un lien stylé avec la couleur primaire de marque", () => {
    const html = renderEmailButton("Créer mon compte", "https://attribmaster.com/signup");
    expect(html).toContain('href="https://attribmaster.com/signup"');
    expect(html).toContain("Créer mon compte");
    expect(html).toContain("#8a4b2e"); // --primary
  });
});
