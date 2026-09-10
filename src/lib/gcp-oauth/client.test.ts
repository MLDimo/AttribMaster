import { afterEach, describe, expect, it, vi } from "vitest";

const getAccessToken = vi.fn(async (): Promise<{ token: string | null }> => ({ token: "a-fresh-access-token" }));
const setCredentials = vi.fn();

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({ setCredentials, getAccessToken })),
}));

describe("mintAccessToken", () => {
  it("échange le refresh token contre un access token frais, à remettre au Picker", async () => {
    const { mintAccessToken } = await import("./client");

    const token = await mintAccessToken("a-refresh-token");

    expect(setCredentials).toHaveBeenCalledWith({ refresh_token: "a-refresh-token" });
    expect(token).toBe("a-fresh-access-token");
  });

  it("lève une erreur explicite si Google ne renvoie aucun token (jamais un undefined silencieux)", async () => {
    getAccessToken.mockResolvedValueOnce({ token: null });
    const { mintAccessToken } = await import("./client");

    await expect(mintAccessToken("a-refresh-token")).rejects.toThrow(/access token/i);
  });
});

describe("googleCloudProjectNumber", () => {
  const ORIGINAL = process.env.GOOGLE_CLIENT_ID;
  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = ORIGINAL;
  });

  it("extrait le préfixe numérique d'un vrai client ID Google", async () => {
    process.env.GOOGLE_CLIENT_ID = "565818019661-msj12ru5j6qkqopk5l0aodq9t38lvein.apps.googleusercontent.com";
    const { googleCloudProjectNumber } = await import("./client");

    expect(googleCloudProjectNumber()).toBe("565818019661");
  });

  it("renvoie null si GOOGLE_CLIENT_ID est absent, plutôt qu'une chaîne vide silencieuse", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const { googleCloudProjectNumber } = await import("./client");

    expect(googleCloudProjectNumber()).toBeNull();
  });
});
