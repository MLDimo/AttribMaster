import { describe, expect, it } from "vitest";

import { planFailureAlert, type FailureAlertCandidate } from "./failure-alerts";

const BILLING_ERROR =
  "Billing has not been enabled for this project. DML queries are not allowed in the free tier.";

function candidate(overrides: Partial<FailureAlertCandidate> = {}): FailureAlertCandidate {
  return {
    project_id: "p1",
    project_name: "Projet client",
    gcp_project_id: "test-trench",
    error: BILLING_ERROR,
    last_success_at: "2026-08-03T02:00:00.000Z",
    billing_alert_sent_at: null,
    owner_emails: ["client@example.com"],
    ...overrides,
  };
}

describe("planFailureAlert", () => {
  it("envoie l'email de facturation la première fois", () => {
    expect(planFailureAlert(candidate())).toEqual({ kind: "billing", send: true });
  });

  it("n'envoie qu'une seule fois : silence tant que la panne dure", () => {
    const alreadySent = candidate({ billing_alert_sent_at: "2026-08-09T02:00:00.000Z" });
    expect(planFailureAlert(alreadySent)).toEqual({ kind: "billing", send: false });
  });

  it("réenvoie après une panne de facturation ultérieure (le run réussi a remis le marqueur à null)", () => {
    // completeJob remet billing_alert_sent_at à NULL au premier succès : une
    // nouvelle panne repart donc de zéro et doit bien réalerter.
    expect(planFailureAlert(candidate({ billing_alert_sent_at: null }))).toEqual({
      kind: "billing",
      send: true,
    });
  });

  it("laisse les autres pannes au throttle glissant habituel, même déjà alertées pour facturation", () => {
    const other = candidate({ error: "invalid_grant", billing_alert_sent_at: "2026-08-09T02:00:00.000Z" });
    expect(planFailureAlert(other)).toEqual({ kind: "generic", send: true });
  });
});
