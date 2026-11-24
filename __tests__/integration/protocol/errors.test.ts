import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Nock, sampleDocument } from "plone-mcp/__tests__/utils/test-helpers";
import { modernRequest } from "plone-mcp/__tests__/utils/mcp-request";

const testBaseUrl = "http://localhost:8080/Plone";

describe("errors on the wire (2026-07-28)", () => {
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

  describe("resources/read", () => {
    it("answers a missing content item with -32602 and the URI", async () => {
      Nock(testBaseUrl).get("/++api++/missing").reply(404, "Not Found");

      const { error, result } = await modernRequest("resources/read", {
        uri: "plone://content/missing",
      });

      expect(result).toBeUndefined();
      expect(error).toMatchObject({
        code: -32602,
        data: { uri: "plone://content/missing" },
      });
    });

    it("answers other Plone failures with -32603", async () => {
      Nock(testBaseUrl).get("/++api++/broken").reply(500, "Boom");

      const { error } = await modernRequest("resources/read", {
        uri: "plone://content/broken",
      });

      expect(error.code).toBe(-32603);
    });
  });

  describe("tools/call", () => {
    const getContent = (path: string) =>
      modernRequest("tools/call", {
        name: "plone_get_content",
        arguments: { path },
      });

    it("returns a Plone failure as a tool error, not a protocol error", async () => {
      Nock(testBaseUrl).get("/++api++/missing").reply(404, "Not Found");

      const { error, result } = await getContent("/missing");

      expect(error).toBeUndefined();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(
        "[GetContent] Request failed with status code 404",
      );
    });

    it.each([401, 403])(
      "tells the model when Plone answers %i",
      async (status) => {
        Nock(testBaseUrl).get("/++api++/private").reply(status);

        const { result } = await getContent("/private");

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain(
          `Not authorized by Plone (HTTP ${status})`,
        );
      },
    );

    it("says when Plone cannot be reached", async () => {
      Nock(testBaseUrl)
        .get("/++api++/page")
        .replyWithError({ code: "ECONNREFUSED", message: "" });

      const { result } = await getContent("/page");

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(
        `[GetContent] Could not reach Plone at ${testBaseUrl} (ECONNREFUSED)`,
      );
    });

    it("answers an unknown tool with -32602", async () => {
      const { error } = await modernRequest("tools/call", {
        name: "plone_does_not_exist",
        arguments: {},
      });

      expect(error.code).toBe(-32602);
    });

    it("still returns content on success", async () => {
      Nock(testBaseUrl).get("/++api++/page").reply(200, sampleDocument);

      const { result } = await getContent("/page");

      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(sampleDocument);
    });
  });
});
