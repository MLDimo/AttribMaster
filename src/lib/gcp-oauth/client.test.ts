import { describe, expect, it, vi } from "vitest";

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
