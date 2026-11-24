import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Nock,
  PloneMockServer,
  sampleDocument,
  sampleSearchResults,
} from "plone-mcp/__tests__/utils/test-helpers";
import {
  freshHandler,
  modernRequest,
} from "plone-mcp/__tests__/utils/mcp-request";
import type { AuthInfo } from "@modelcontextprotocol/server";

const testBaseUrl = "http://localhost:8080/Plone";

const authInfo = (token: string): AuthInfo => ({
  token,
  clientId: "plone-mcp",
  scopes: [],
});

describe("statelessness", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
    vi.stubEnv("PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP", "true");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    Nock.cleanAll();
  });

  it("runs a multi-step flow with a new handler for every request", async () => {
    const plone = new PloneMockServer(testBaseUrl);
    plone.mockSearch({ SearchableText: "test" }, sampleSearchResults);
    plone.mockContentGet("/test-document", sampleDocument);
    plone.mockContentUpdate(
      "/test-document",
      { title: "Updated" },
      { ...sampleDocument, title: "Updated" },
    );

    const steps = [
      { name: "plone_search", arguments: { query: "test" } },
      { name: "plone_get_content", arguments: { path: "/test-document" } },
      {
        name: "plone_update_content",
        arguments: { path: "/test-document", title: "Updated" },
      },
    ];
    for (const step of steps) {
      const { result } = await modernRequest("tools/call", step, {
        target: freshHandler(),
      });
      expect(result.isError).toBeUndefined();
    }

    expect(Nock.isDone()).toBe(true);
  });

  it("sends each interleaved caller's own token to Plone", async () => {
    for (const token of ["token-a", "token-b"]) {
      Nock(testBaseUrl, { reqheaders: { authorization: `Bearer ${token}` } })
        .get("/++api++/test-document")
        .times(2)
        .delay(token === "token-a" ? 20 : 0)
        .reply(200, { ...sampleDocument, title: token });
    }
    const call = (token: string) =>
      modernRequest(
        "tools/call",
        { name: "plone_get_content", arguments: { path: "/test-document" } },
        { authInfo: authInfo(token) },
      );

    const results = await Promise.all(
      ["token-a", "token-b", "token-a", "token-b"].map(call),
    );

    expect(
      results.map(({ result }) => JSON.parse(result.content[0].text).title),
    ).toEqual(["token-a", "token-b", "token-a", "token-b"]);
    expect(Nock.isDone()).toBe(true);
  });

  it("leaves no timers behind", async () => {
    const timers = () =>
      process.getActiveResourcesInfo().filter((name) => name === "Timeout")
        .length;
    const before = timers();

    for (let i = 0; i < 5; i++) {
      await modernRequest("tools/list", {}, { target: freshHandler() });
    }

    expect(timers()).toBeLessThanOrEqual(before);
  });
});
