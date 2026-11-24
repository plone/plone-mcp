import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { SignJWT, UnsecuredJWT, exportSPKI } from "jose";
import {
  ENV_OAUTH_ALLOWED_CLIENT_IDS,
  ENV_OAUTH_ISSUER,
  createTokenVerifier,
  readOAuthConfig,
} from "plone-mcp/auth/verifier";
import {
  FakeIssuer,
  TEST_CLIENT_ID as CLIENT_ID,
  type FakeSite,
  type SignOptions,
} from "plone-mcp/__tests__/utils/fake-issuer";

const fake = new FakeIssuer();

function newSite(overrides: Partial<FakeSite> = {}) {
  const { site, issuer } = fake.addSite(overrides);
  const verifier = createTokenVerifier({
    issuer,
    allowedClientIds: [CLIENT_ID],
  });
  return { site, issuer, verifier };
}

const sign = (issuer: string, options?: SignOptions) =>
  fake.sign(issuer, options);

beforeAll(() => fake.start());

afterAll(() => {
  fake.close();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const invalidToken = { code: "invalid_token", message: "Invalid access token" };
const serverError = { code: "server_error" };

describe("createTokenVerifier", () => {
  it("accepts a valid token and returns authInfo", async () => {
    const { issuer, verifier } = newSite();
    const token = await sign(issuer);

    const authInfo = await verifier.verifyAccessToken(token);

    expect(authInfo).toMatchObject({
      token,
      clientId: CLIENT_ID,
      scopes: ["openid", "profile"],
      extra: { userId: "mcp-editor" },
    });
    expect(authInfo.expiresAt).toBeGreaterThan(Date.now() / 1000);
  });

  it("rejects an expired token", async () => {
    const { issuer, verifier } = newSite();
    const token = await sign(issuer, {
      expiresIn: Math.floor(Date.now() / 1000) - 60,
    });

    await expect(verifier.verifyAccessToken(token)).rejects.toMatchObject(
      invalidToken,
    );
  });

  it("rejects a token that expires within a minute", async () => {
    const { issuer, verifier } = newSite();
    const token = await sign(issuer, { expiresIn: "30s" });

    await expect(verifier.verifyAccessToken(token)).rejects.toMatchObject(
      invalidToken,
    );
  });

  it("rejects a token from another issuer", async () => {
    const { verifier } = newSite();
    const token = await sign("https://other.example/Plone");

    await expect(verifier.verifyAccessToken(token)).rejects.toMatchObject(
      invalidToken,
    );
  });

  it("rejects a token whose typ is not at+jwt, such as an id token", async () => {
    const { issuer, verifier } = newSite();
    const token = await sign(issuer, { typ: "JWT" });

    await expect(verifier.verifyAccessToken(token)).rejects.toMatchObject(
      invalidToken,
    );
  });

  it("rejects a bad signature", async () => {
    const { issuer, verifier } = newSite();
    const token = await sign(issuer, { key: fake.key2, kid: "key-1" });

    await expect(verifier.verifyAccessToken(token)).rejects.toMatchObject(
      invalidToken,
    );
  });

  it("rejects alg none", async () => {
    const { issuer, verifier } = newSite();
    const token = new UnsecuredJWT({ sub: "mcp-editor" })
      .setIssuer(issuer)
      .setAudience(CLIENT_ID)
      .setExpirationTime("15m")
      .encode();

    await expect(verifier.verifyAccessToken(token)).rejects.toMatchObject(
      invalidToken,
    );
  });

  it("rejects an HMAC token signed with the public key", async () => {
    const { issuer, verifier } = newSite();
    const secret = new TextEncoder().encode(await exportSPKI(fake.key1.publicKey));
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "at+jwt", kid: "key-1" })
      .setIssuer(issuer)
      .setAudience(CLIENT_ID)
      .setSubject("mcp-editor")
      .setExpirationTime("15m")
      .sign(secret);

    await expect(verifier.verifyAccessToken(token)).rejects.toMatchObject(
      invalidToken,
    );
  });

  it("rejects a token issued to a client that is not allowed", async () => {
    const { issuer, verifier } = newSite();
    const token = await sign(issuer, { aud: "plone-mcp-not-allowed" });

    await expect(verifier.verifyAccessToken(token)).rejects.toMatchObject(
      invalidToken,
    );
  });

  it("rejects a token without sub", async () => {
    const { issuer, verifier } = newSite();
    const token = await sign(issuer, { sub: null });

    await expect(verifier.verifyAccessToken(token)).rejects.toMatchObject(
      invalidToken,
    );
  });

  it("refetches keys on an unknown kid, at most once per cooldown", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { site, issuer, verifier } = newSite();
    await verifier.verifyAccessToken(await sign(issuer));
    expect(site.jwksFetches).toBe(1);

    // Plone rotates its keys.
    site.keys = [fake.key2.jwk, fake.key1.jwk];
    const rotated = await sign(issuer, { key: fake.key2 });

    // Within the cooldown the unknown kid does not trigger a fetch.
    await expect(verifier.verifyAccessToken(rotated)).rejects.toMatchObject(
      invalidToken,
    );
    expect(site.jwksFetches).toBe(1);

    vi.advanceTimersByTime(31_000);
    const authInfo = await verifier.verifyAccessToken(rotated);

    expect(authInfo.extra).toEqual({ userId: "mcp-editor" });
    expect(site.jwksFetches).toBe(2);
  });

  it("answers server_error when the JWKS endpoint is down", async () => {
    const { issuer, verifier } = newSite({ jwksStatus: 503 });

    await expect(
      verifier.verifyAccessToken(await sign(issuer)),
    ).rejects.toMatchObject(serverError);
  });

  it("answers server_error when discovery names a different issuer", async () => {
    const { issuer, verifier } = newSite({
      discoveryIssuer: "https://other.example/Plone",
    });

    await expect(
      verifier.verifyAccessToken(await sign(issuer)),
    ).rejects.toMatchObject(serverError);
  });

  it("retries discovery on the next request after a failure", async () => {
    const { site, issuer, verifier } = newSite({ discoveryStatus: 503 });
    const token = await sign(issuer);
    await expect(verifier.verifyAccessToken(token)).rejects.toMatchObject(
      serverError,
    );

    site.discoveryStatus = 200;

    await expect(verifier.verifyAccessToken(token)).resolves.toMatchObject({
      clientId: CLIENT_ID,
    });
  });

  it("rejects a malformed token without echoing it", async () => {
    const { verifier } = newSite();

    const error = await verifier
      .verifyAccessToken("not-a-jwt-secret-value")
      .catch((e: Error) => e);

    expect(error).toMatchObject(invalidToken);
    expect(String((error as Error).message)).not.toContain("secret-value");
  });
});

describe("readOAuthConfig", () => {
  it("is off when the issuer is unset", () => {
    vi.stubEnv(ENV_OAUTH_ISSUER, "");

    expect(readOAuthConfig()).toBeUndefined();
  });

  it("refuses an issuer without an allow-list", () => {
    vi.stubEnv(ENV_OAUTH_ISSUER, "http://localhost:8090/Plone");
    vi.stubEnv(ENV_OAUTH_ALLOWED_CLIENT_IDS, " , ");

    expect(() => readOAuthConfig()).toThrow(ENV_OAUTH_ALLOWED_CLIENT_IDS);
  });

  it("reads the issuer as is and trims the client ids", () => {
    vi.stubEnv(ENV_OAUTH_ISSUER, "http://localhost:8090/Plone/");
    vi.stubEnv(ENV_OAUTH_ALLOWED_CLIENT_IDS, "a, b ,,c");

    expect(readOAuthConfig()).toEqual({
      issuer: "http://localhost:8090/Plone/",
      allowedClientIds: ["a", "b", "c"],
    });
  });
});
