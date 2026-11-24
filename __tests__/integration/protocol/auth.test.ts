import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { handler } from "plone-mcp/handler";
import {
  FakeIssuer,
  TEST_CLIENT_ID,
} from "plone-mcp/__tests__/utils/fake-issuer";
import { modernHttpRequest } from "plone-mcp/__tests__/utils/mcp-request";
import {
  Nock,
  sampleDocument,
} from "plone-mcp/__tests__/utils/test-helpers";

const testBaseUrl = "http://localhost:8080/Plone";
const resourceUrl = "http://localhost:3001/mcp";
const metadataUrl =
  "http://localhost:3001/.well-known/oauth-protected-resource/mcp";

const fake = new FakeIssuer();
let issuer: string;

const send = (request: Request) => handler.fetch(request);

function getContent(path: string, authorization?: string) {
  const request = modernHttpRequest("tools/call", {
    name: "plone_get_content",
    arguments: { path },
  });
  if (authorization) {
    request.headers.set("Authorization", authorization);
  }
  return request;
}

function toolsList(authorization?: string) {
  const request = modernHttpRequest("tools/list");
  if (authorization) {
    request.headers.set("Authorization", authorization);
  }
  return request;
}

const metadataRequest = (path: string, method = "GET") =>
  new Request(`http://localhost${path}`, { method });

function useOAuth(siteIssuer = issuer) {
  vi.stubEnv("PLONE_OAUTH_ISSUER", siteIssuer);
  vi.stubEnv("PLONE_OAUTH_ALLOWED_CLIENT_IDS", TEST_CLIENT_ID);
  vi.stubEnv("PLONE_MCP_RESOURCE_URL", resourceUrl);
}

describe("HTTP authorization", () => {
  beforeAll(() => fake.start());

  afterAll(() => {
    fake.close();
  });

  beforeEach(() => {
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
    vi.stubEnv("PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP", "false");
    issuer = fake.addSite().issuer;
    useOAuth();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    Nock.cleanAll();
  });

  describe("Protected Resource Metadata", () => {
    it.each([
      "/.well-known/oauth-protected-resource/mcp",
      "/.well-known/oauth-protected-resource",
    ])("is served at %s without a token", async (path) => {
      const response = await send(metadataRequest(path));

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Cache-Control")).toContain("public");
      const body = await response.json();
      expect(body).toEqual({
        resource: resourceUrl,
        authorization_servers: [issuer],
        resource_name: "Plone MCP Server",
      });
      expect(body).not.toHaveProperty("scopes_supported");
    });

    it("refuses methods other than GET, HEAD and OPTIONS", async () => {
      const path = "/.well-known/oauth-protected-resource/mcp";

      expect((await send(metadataRequest(path, "HEAD"))).status).toBe(200);
      expect((await send(metadataRequest(path, "OPTIONS"))).status).toBe(204);
      expect((await send(metadataRequest(path, "POST"))).status).toBe(405);
    });

    it("is not served when OAuth is off", async () => {
      vi.stubEnv("PLONE_OAUTH_ISSUER", "");
      vi.stubEnv("PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP", "true");

      const response = await send(
        metadataRequest("/.well-known/oauth-protected-resource/mcp"),
      );

      expect(response.status).toBe(404);
    });
  });

  describe("challenge", () => {
    it.each([
      ["no Authorization header", undefined],
      ["a garbage token", "Bearer not-a-token"],
      ["a non-Bearer scheme", "Basic YWRtaW46YWRtaW4="],
    ])("answers %s with 401 and the metadata URL", async (_, authorization) => {
      const response = await send(toolsList(authorization));

      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toMatch(
        new RegExp(`^Bearer .*resource_metadata="${metadataUrl}"`),
      );
      expect((await response.json()).error).toBe("invalid_token");
    });

    it("answers a token issued to a client that is not allowed with 401", async () => {
      const token = await fake.sign(issuer, { aud: "plone-mcp-not-allowed" });

      const response = await send(toolsList(`Bearer ${token}`));

      expect(response.status).toBe(401);
    });

    it("ignores a token in the query string", async () => {
      const token = await fake.sign(issuer);
      const request = toolsList();
      const withQuery = new Request(`${request.url}?access_token=${token}`, {
        method: "POST",
        headers: request.headers,
        body: await request.text(),
      });

      expect((await send(withQuery)).status).toBe(401);
    });

    it("answers 500, not 401, when Plone's keys cannot be loaded", async () => {
      const down = fake.addSite({ discoveryStatus: 503 });
      useOAuth(down.issuer);
      const token = await fake.sign(down.issuer);

      const response = await send(toolsList(`Bearer ${token}`));

      expect(response.status).toBe(500);
      expect(response.headers.get("WWW-Authenticate")).toBeNull();
    });
  });

  describe("valid token", () => {
    it("serves the request", async () => {
      const token = await fake.sign(issuer);

      const response = await send(toolsList(`Bearer ${token}`));

      expect(response.status).toBe(200);
      expect((await response.json()).result.tools.length).toBeGreaterThan(0);
    });

    it("calls Plone with the same token", async () => {
      const token = await fake.sign(issuer);
      Nock(testBaseUrl, { reqheaders: { authorization: `Bearer ${token}` } })
        .get("/++api++/test-document")
        .reply(200, sampleDocument);

      const { result } = await (
        await send(getContent("/test-document", `Bearer ${token}`))
      ).json();

      expect(result.isError).toBeUndefined();
      expect(Nock.isDone()).toBe(true);
    });

    it("keeps concurrent callers apart", async () => {
      const [alice, bob] = await Promise.all([
        fake.sign(issuer, { sub: "alice" }),
        fake.sign(issuer, { sub: "bob" }),
      ]);
      for (const [token, path] of [
        [alice, "/alice-page"],
        [bob, "/bob-page"],
      ]) {
        Nock(testBaseUrl, { reqheaders: { authorization: `Bearer ${token}` } })
          .get(`/++api++${path}`)
          .delay(20)
          .reply(200, { ...sampleDocument, title: path });
      }

      const results = await Promise.all([
        send(getContent("/alice-page", `Bearer ${alice}`)),
        send(getContent("/bob-page", `Bearer ${bob}`)),
      ]);

      for (const [response, path] of [
        [results[0], "/alice-page"],
        [results[1], "/bob-page"],
      ] as const) {
        const { result } = await response.json();
        expect(result.isError).toBeUndefined();
        expect(JSON.parse(result.content[0].text).title).toBe(path);
      }
      expect(Nock.isDone()).toBe(true);
    });
  });

  describe("Plone answering 401", () => {
    it("answers 401 with the challenge when Plone refuses the token, so the client refreshes", async () => {
      const refused = fake.addSite({ userinfoStatus: 401 });
      useOAuth(refused.issuer);
      const token = await fake.sign(refused.issuer);
      Nock(testBaseUrl).get("/++api++/page").reply(401);

      const response = await send(getContent("/page", `Bearer ${token}`));

      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toMatch(
        new RegExp(`^Bearer .*resource_metadata="${metadataUrl}"`),
      );
      expect((await response.json()).error).toBe("invalid_token");
    });

    it.each([
      ["still accepts the token", 200],
      ["cannot be asked", 503],
    ])(
      "answers a tool error when userinfo %s: the user lacks permission",
      async (_, userinfoStatus) => {
        const site = fake.addSite({ userinfoStatus });
        useOAuth(site.issuer);
        const token = await fake.sign(site.issuer);
        Nock(testBaseUrl).get("/++api++/page").reply(401);

        const response = await send(getContent("/page", `Bearer ${token}`));

        expect(response.status).toBe(200);
        const { result } = await response.json();
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("lacks permission");
      },
    );

    it("answers 403 as a tool error", async () => {
      const token = await fake.sign(issuer);
      Nock(testBaseUrl).get("/++api++/page").reply(403);

      const response = await send(getContent("/page", `Bearer ${token}`));

      expect(response.status).toBe(200);
      const { result } = await response.json();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Not authorized by Plone (HTTP 403)",
      );
    });

    it("answers 401 for environment credentials as a tool error", async () => {
      vi.stubEnv("PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP", "true");
      Nock(testBaseUrl).get("/++api++/page").reply(401);

      const response = await send(getContent("/page"));

      expect(response.status).toBe(200);
      const { result } = await response.json();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Not authorized by Plone (HTTP 401)",
      );
    });
  });

  describe("redirects", () => {
    it("follows a same-origin redirect with the token", async () => {
      const token = await fake.sign(issuer);
      Nock(testBaseUrl)
        .get("/++api++/old")
        .reply(302, "", { Location: `${testBaseUrl}/++api++/new` });
      Nock(testBaseUrl, { reqheaders: { authorization: `Bearer ${token}` } })
        .get("/++api++/new")
        .reply(200, sampleDocument);

      const { result } = await (
        await send(getContent("/old", `Bearer ${token}`))
      ).json();

      expect(result.isError).toBeUndefined();
      expect(Nock.isDone()).toBe(true);
    });

    it.each([
      ["another site", "https://elsewhere.example.org/x"],
      ["a subdomain", "http://evil.localhost:8080/x"],
      ["another port", "http://localhost:9999/x"],
    ])("refuses a redirect to %s", async (_, location) => {
      const token = await fake.sign(issuer);
      Nock(testBaseUrl).get("/++api++/page").reply(302, "", { Location: location });
      const target = Nock(new URL(location).origin).get("/x").reply(200, {});

      const { result } = await (
        await send(getContent("/page", `Bearer ${token}`))
      ).json();

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Plone redirected to another origin",
      );
      expect(target.isDone()).toBe(false);
    });
  });

  describe("environment-credentials fallback", () => {
    beforeEach(() => {
      vi.stubEnv("PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP", "true");
    });

    it("serves a request without an Authorization header", async () => {
      expect((await send(toolsList())).status).toBe(200);
    });

    it("never falls back for a bad token", async () => {
      expect((await send(toolsList("Bearer not-a-token"))).status).toBe(401);
    });

    it("serves requests without OAuth configured", async () => {
      vi.stubEnv("PLONE_OAUTH_ISSUER", "");

      expect((await send(toolsList())).status).toBe(200);
    });
  });

  describe("configuration", () => {
    it("answers 500 when neither OAuth nor the fallback is set", async () => {
      vi.stubEnv("PLONE_OAUTH_ISSUER", "");

      const response = await send(toolsList());

      expect(response.status).toBe(500);
      expect(await response.text()).toBe("MCP server not configured");
    });

    it.each([
      ["PLONE_MCP_RESOURCE_URL", ""],
      ["PLONE_OAUTH_ALLOWED_CLIENT_IDS", ""],
      ["PLONE_OAUTH_ISSUER", "http://plone.example.com/Plone"],
    ])("answers 500 when %s is %j", async (name, value) => {
      vi.stubEnv(name, value);

      expect((await send(toolsList())).status).toBe(500);
    });
  });
});
