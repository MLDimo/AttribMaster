import { describe, expect, it } from "vitest";

import { escapeHtml } from "./resend";

describe("escapeHtml", () => {
  it("neutralise une balise injectée via un nom de projet", () => {
    // Scénario réel : un membre du workspace renomme un projet, l'email
    // d'alerte part aux OWNERS — l'injection traverse les utilisateurs.
    expect(escapeHtml('<a href="https://phishing.example">Cliquez ici</a>')).toBe(
      "&lt;a href=&quot;https://phishing.example&quot;&gt;Cliquez ici&lt;/a&gt;"
    );
  });

  it("échappe l'esperluette en premier, sans double-échapper le reste", () => {
    expect(escapeHtml("Marque & Co <b>")).toBe("Marque &amp; Co &lt;b&gt;");
  });

  it("échappe les deux types de guillemets, qui permettent de sortir d'un attribut", () => {
    expect(escapeHtml(`" onmouseover='x'`)).toBe("&quot; onmouseover=&#39;x&#39;");
  });

  it("laisse intact un texte ordinaire", () => {
    expect(escapeHtml("Boutique Été 2026")).toBe("Boutique Été 2026");
  });

  it("gère la chaîne vide", () => {
    expect(escapeHtml("")).toBe("");
  });
});
