import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./secrets";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext value", () => {
    const plaintext = "ya29.some-oauth-refresh-token-value";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const plaintext = "same-input";
    expect(encryptSecret(plaintext)).not.toBe(encryptSecret(plaintext));
  });

  it("fails to decrypt if the ciphertext is tampered with", () => {
    const encrypted = encryptSecret("sensitive-value");
    const tampered = encrypted.slice(0, -4) + "abcd";
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
