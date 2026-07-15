import { describe, expect, it } from "vitest";

import { buildSubscriptionLineItems } from "./checkout";

describe("buildSubscriptionLineItems", () => {
  it("annual billing never includes the setup fee, even if requested", () => {
    const items = buildSubscriptionLineItems("standard", "annual", true);
    expect(items).toHaveLength(1);
  });

  it("monthly billing without includeSetup has no setup fee", () => {
    const items = buildSubscriptionLineItems("standard", "monthly", false);
    expect(items).toHaveLength(1);
  });

  it("monthly billing with includeSetup adds the setup fee as a second line item", () => {
    const items = buildSubscriptionLineItems("standard", "monthly", true);
    expect(items).toHaveLength(2);
    expect(items[0].quantity).toBe(1);
    expect(items[1].quantity).toBe(1);
    expect(items[0].price).not.toBe(items[1].price);
  });

  it("monthly billing with includeSetup undefined behaves like false", () => {
    const items = buildSubscriptionLineItems("pro", "monthly", undefined);
    expect(items).toHaveLength(1);
  });
});
