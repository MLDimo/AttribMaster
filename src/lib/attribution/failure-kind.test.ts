import { describe, expect, it } from "vitest";

import { classifyNightlyFailure } from "./queue";

describe("classifyNightlyFailure", () => {
  // Messages relevés tels quels en production sur un projet GCP dont le compte
  // de facturation avait sauté : BigQuery les formule différemment selon
  // l'opération refusée, mais la cause et le geste correctif sont les mêmes.
  it("reconnaît le refus de DML faute de facturation", () => {
    expect(
      classifyNightlyFailure(
        "Billing has not been enabled for this project. Enable billing at https://console.cloud.google.com/billing. DML queries are not allowed in the free tier. Set up a billing account to remove this restriction. at [19:1]"
      )
    ).toBe("billing");
  });

  it("reconnaît la contrainte d'expiration propre au mode sandbox", () => {
    expect(
      classifyNightlyFailure(
        "Billing has not been enabled for this project. Datasets must have a default expiration time and default partition expiration time of less than 60 days while in sandbox mode."
      )
    ).toBe("billing");
  });

  it("reconnaît un message qui ne mentionne QUE le sandbox", () => {
    expect(
      classifyNightlyFailure("Partition expiration time must be less than 60 days while in sandbox mode.")
    ).toBe("billing");
  });

  it("laisse en générique les autres pannes, qui appellent un autre conseil", () => {
    expect(classifyNightlyFailure("invalid_grant")).toBe("generic");
    expect(classifyNightlyFailure("Query error: Query column 8 has type ARRAY<STRUCT<...>>")).toBe("generic");
    expect(classifyNightlyFailure("Not found: Dataset attribution")).toBe("generic");
  });

  it("ne classe rien comme facturation en l'absence de message", () => {
    expect(classifyNightlyFailure(null)).toBe("generic");
    expect(classifyNightlyFailure("")).toBe("generic");
  });
});
