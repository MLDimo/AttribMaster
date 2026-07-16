import { describe, expect, it } from "vitest";

import { isApiPath, isPublicPath, shouldRedirectToLogin } from "./public-paths";

describe("isPublicPath", () => {
  it("treats the exact known public routes as public", () => {
    for (const path of [
      "/",
      "/login",
      "/mentions-legales",
      "/cgu",
      "/cgv",
      "/politique-de-confidentialite",
      "/opengraph-image",
      "/twitter-image",
      "/robots.txt",
      "/sitemap.xml",
    ]) {
      expect(isPublicPath(path)).toBe(true);
    }
  });

  it("does NOT treat sub-paths as public just because they start with a public prefix", () => {
    // Régression : "/" ne doit pas rendre tout le site public via startsWith.
    expect(isPublicPath("/projects")).toBe(false);
    expect(isPublicPath("/account")).toBe(false);
    expect(isPublicPath("/login/something")).toBe(false);
  });
});

describe("isApiPath", () => {
  it("matches any /api/* route", () => {
    expect(isApiPath("/api/projects")).toBe(true);
    expect(isApiPath("/api/webhooks/stripe")).toBe(true);
  });

  it("does not match non-api routes", () => {
    expect(isApiPath("/projects")).toBe(false);
  });
});

describe("shouldRedirectToLogin", () => {
  it("redirects an unauthenticated user on a protected page", () => {
    expect(shouldRedirectToLogin("/projects", false)).toBe(true);
  });

  it("does not redirect an authenticated user", () => {
    expect(shouldRedirectToLogin("/projects", true)).toBe(false);
  });

  it("never redirects on a public page, authenticated or not", () => {
    expect(shouldRedirectToLogin("/login", false)).toBe(false);
    expect(shouldRedirectToLogin("/", false)).toBe(false);
  });

  it("never redirects API routes (they enforce their own auth)", () => {
    expect(shouldRedirectToLogin("/api/projects", false)).toBe(false);
  });
});
