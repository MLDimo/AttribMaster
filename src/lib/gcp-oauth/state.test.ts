import { describe, expect, it } from "vitest";

import { createOAuthNonce, isValidNonce, packOAuthState, parseOAuthState } from "./state";

describe("OAuth state anti-CSRF helpers", () => {
  it("round-trips projectId + nonce through pack/parse", () => {
    const nonce = createOAuthNonce();
    const state = packOAuthState("5cbb9f60-d11d-4461-8879-24e20f871439", nonce);
    expect(parseOAuthState(state)).toEqual({
      projectId: "5cbb9f60-d11d-4461-8879-24e20f871439",
      nonce,
    });
  });

  it("rejects malformed states (old format without nonce included)", () => {
    expect(parseOAuthState("just-a-project-id")).toBeNull();
    expect(parseOAuthState(":no-project")).toBeNull();
    expect(parseOAuthState("no-nonce:")).toBeNull();
    expect(parseOAuthState("")).toBeNull();
  });

  it("generates unique unpredictable nonces", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => createOAuthNonce()));
    expect(nonces.size).toBe(50);
    expect(createOAuthNonce()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("validates only a matching cookie nonce", () => {
    const nonce = createOAuthNonce();
    expect(isValidNonce(nonce, nonce)).toBe(true);
    expect(isValidNonce(nonce, createOAuthNonce())).toBe(false);
    expect(isValidNonce(nonce, undefined)).toBe(false);
    expect(isValidNonce(nonce, "short")).toBe(false);
  });
});
