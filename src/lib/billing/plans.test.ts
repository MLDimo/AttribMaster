import { describe, expect, it } from "vitest";

import { PLANS, SETUP_FEE_EUROS, planById } from "./plans";

describe("PLANS catalog", () => {
  it("has exactly standard, pro, custom with unique ids", () => {
    const ids = PLANS.map((p) => p.id);
    expect(ids).toEqual(["standard", "pro", "custom"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("self-serve plans (standard/pro) have a numeric monthly price", () => {
    for (const plan of PLANS.filter((p) => p.selfServe)) {
      expect(typeof plan.monthlyPriceEuros).toBe("number");
      expect(plan.monthlyPriceEuros).toBeGreaterThan(0);
    }
  });

  it("the custom plan is not self-serve and has no fixed monthly price", () => {
    const custom = planById("custom");
    expect(custom.selfServe).toBe(false);
    expect(custom.monthlyPriceEuros).toBeNull();
    expect(custom.fromPriceEuros).toBeGreaterThan(0);
  });

  it("pro costs more than standard", () => {
    expect(planById("pro").monthlyPriceEuros).toBeGreaterThan(planById("standard").monthlyPriceEuros!);
  });
});

describe("planById", () => {
  it("throws on an unknown plan id", () => {
    // @ts-expect-error - id volontairement invalide pour tester le throw
    expect(() => planById("enterprise")).toThrow(/Unknown plan/);
  });
});

describe("SETUP_FEE_EUROS", () => {
  it("is a positive amount", () => {
    expect(SETUP_FEE_EUROS).toBeGreaterThan(0);
  });
});
