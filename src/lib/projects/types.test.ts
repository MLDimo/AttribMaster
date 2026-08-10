import { describe, expect, it } from "vitest";

import { getCustomModelConfig, isProjectConnected, isProjectSubscribed, type Project } from "./types";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Projet",
    gcp_project_id: "test-trench",
    ga4_dataset: "analytics_1",
    bigquery_dataset: "attribution",
    oauth_refresh_token_encrypted: "chiffre",
    created_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    billing_account_id: null,
    plan: "standard",
    billing_interval: null,
    stripe_subscription_id: null,
    subscription_status: "active",
    custom_model_first_touch_pct: null,
    custom_model_middle_pct: null,
    custom_model_last_touch_pct: null,
    custom_model_rules: [],
    export_google_sheet_url: null,
    export_google_sheet_last_synced_at: null,
    export_google_sheet_last_error: null,
    ...overrides,
  };
}

// Ces deux prédicats décident quels projets le cron nocturne traite
// (enqueueBackfillForAllProjects) : un faux négatif ne lève aucune erreur, il
// se contente de ne plus jamais mettre le projet à jour — d'où ces tests.
describe("isProjectConnected", () => {
  it("vrai quand les trois éléments de connexion sont là", () => {
    expect(isProjectConnected(project())).toBe(true);
  });

  it.each([
    ["gcp_project_id", { gcp_project_id: null }],
    ["ga4_dataset", { ga4_dataset: null }],
    ["oauth_refresh_token_encrypted", { oauth_refresh_token_encrypted: null }],
  ])("faux dès que %s manque", (_label, missing) => {
    expect(isProjectConnected(project(missing))).toBe(false);
  });

  it("traite la chaîne vide comme absente, pas comme une valeur", () => {
    expect(isProjectConnected(project({ ga4_dataset: "" }))).toBe(false);
  });
});

describe("isProjectSubscribed", () => {
  it.each(["active", "trialing"])("actif pour le statut Stripe %s", (status) => {
    expect(isProjectSubscribed(project({ subscription_status: status }))).toBe(true);
  });

  it.each(["canceled", "past_due", "unpaid", "incomplete", null])(
    "inactif pour le statut %s",
    (status) => {
      expect(isProjectSubscribed(project({ subscription_status: status }))).toBe(false);
    }
  );
});

describe("getCustomModelConfig", () => {
  it("null quand le modèle n'est pas configuré", () => {
    expect(getCustomModelConfig(project())).toBeNull();
  });

  it("assemble les trois pourcentages et les règles", () => {
    const config = getCustomModelConfig(
      project({
        custom_model_first_touch_pct: 50,
        custom_model_middle_pct: 10,
        custom_model_last_touch_pct: 40,
        custom_model_rules: [{ channelValue: "google / cpc", position: "first", percent: 70 }],
      })
    );
    expect(config).toEqual({
      firstTouchPercent: 50,
      middlePercent: 10,
      lastTouchPercent: 40,
      rules: [{ channelValue: "google / cpc", position: "first", percent: 70 }],
    });
  });

  it("gère un 0 % de premier contact sans le confondre avec 'non configuré'", () => {
    // Le prédicat teste `=== null`, pas la véracité : un 0 % légitime (tout le
    // poids au dernier contact) ne doit pas faire retomber sur "pas de modèle".
    const config = getCustomModelConfig(
      project({
        custom_model_first_touch_pct: 0,
        custom_model_middle_pct: 0,
        custom_model_last_touch_pct: 100,
      })
    );
    expect(config).toEqual({
      firstTouchPercent: 0,
      middlePercent: 0,
      lastTouchPercent: 100,
      rules: [],
    });
  });
});
