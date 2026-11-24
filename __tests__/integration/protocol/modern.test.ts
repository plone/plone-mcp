import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Nock,
  PloneMockServer,
  sampleDocument,
  sampleSearchResults,
} from "plone-mcp/__tests__/utils/test-helpers";
import {
  MODERN_VERSION,
  modernRequest,
} from "plone-mcp/__tests__/utils/mcp-request";
import packageJson from "../../../package.json";

const testBaseUrl = "http://localhost:8080/Plone";

describe("2026-07-28 over HTTP", () => {
  let plone: PloneMockServer;

  beforeEach(() => {
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
    vi.stubEnv("PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP", "true");
    plone = new PloneMockServer(testBaseUrl);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    Nock.cleanAll();
  });

  it("answers server/discover", async () => {
    const { result } = await modernRequest("server/discover");

    expect(result).toMatchObject({
      supportedVersions: [MODERN_VERSION],
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
        prompts: { listChanged: false },
      },
      resultType: "complete",
      ttlMs: 3600000,
      cacheScope: "public",
      _meta: {
        "io.modelcontextprotocol/serverInfo": {
          name: "plone-mcp-server",
          version: packageJson.version,
        },
      },
    });
  });

  it("runs a read tool", async () => {
    plone.mockSearch({ SearchableText: "news" }, sampleSearchResults);

    const { result } = await modernRequest("tools/call", {
      name: "plone_search",
      arguments: { query: "news" },
    });

    expect(result.resultType).toBe("complete");
    expect(JSON.parse(result.content[0].text)).toEqual(sampleSearchResults);
    expect(result.structuredContent).toEqual(sampleSearchResults);
    expect(Nock.isDone()).toBe(true);
  });

  describe("trace context", () => {
    const traceparent =
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

    const getContent = (_meta?: Record<string, unknown>) =>
      modernRequest("tools/call", {
        name: "plone_get_content",
        arguments: { path: "/test-document" },
        ...(_meta && { _meta }),
      });

    it("forwards the client's trace context to Plone", async () => {
      Nock(testBaseUrl, {
        reqheaders: { traceparent, tracestate: "vendor=abc" },
      })
        .get("/++api++/test-document")
        .reply(200, sampleDocument);

      const { result } = await getContent({
        traceparent,
        tracestate: "vendor=abc",
      });

      expect(result.isError).toBeUndefined();
      expect(Nock.isDone()).toBe(true);
    });

    it("sends no trace headers when the client sent none", async () => {
      Nock(testBaseUrl, { badheaders: ["traceparent", "tracestate", "baggage"] })
        .get("/++api++/test-document")
        .reply(200, sampleDocument);

      const { result } = await getContent();

      expect(result.isError).toBeUndefined();
      expect(Nock.isDone()).toBe(true);
    });

    it("drops a malformed traceparent", async () => {
      Nock(testBaseUrl, { badheaders: ["traceparent"] })
        .get("/++api++/test-document")
        .reply(200, sampleDocument);

      const { result } = await getContent({ traceparent: "not-a-trace" });

      expect(result.isError).toBeUndefined();
      expect(Nock.isDone()).toBe(true);
    });

    it("keeps concurrent requests' trace context apart", async () => {
      const other = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";
      const seen: string[] = [];
      Nock(testBaseUrl)
        .get("/++api++/test-document")
        .times(2)
        .delay(20)
        .reply(function () {
          seen.push(String(this.req.headers.traceparent));
          return [200, sampleDocument];
        });

      await Promise.all([
        getContent({ traceparent }),
        getContent({ traceparent: other }),
      ]);

      expect(seen.sort()).toEqual([traceparent, other].sort());
    });
  });

  it("refuses a requestState it did not sign", async () => {
    vi.stubEnv(
      "PLONE_MCP_STATE_SECRET",
      "a-test-secret-that-is-at-least-32-bytes",
    );

    const response = await modernRequest("tools/call", {
      name: "plone_get_content",
      arguments: { path: "/test-document" },
      requestState: "v1.forged.state",
    });

    expect(response.error).toMatchObject({
      code: -32602,
      message: "Invalid or expired requestState",
    });
  });

  it("declares output schemas for tools with a stable result", async () => {
    const { result } = await modernRequest("tools/list");
    const declared = result.tools.filter((tool: any) => tool.outputSchema);

    expect(declared.map((tool: any) => tool.name).sort()).toEqual([
      "plone_cancel_working_copy",
      "plone_checkin_working_copy",
      "plone_delete_content",
      "plone_get_navigation_tree",
      "plone_search",
      "plone_unlink_translation",
      "plone_update_user",
      "plone_validate_blocks",
    ]);
    expect(JSON.stringify(declared)).not.toContain('"$ref"');
  });

  it("refuses a result that does not match its output schema", async () => {
    plone.mockSearch(
      { SearchableText: "news" },
      { items: [{ "@id": `${testBaseUrl}/news` }], items_total: 1 },
    );

    const { result } = await modernRequest("tools/call", {
      name: "plone_search",
      arguments: { query: "news" },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Output validation error");
  });

  it("does not check an error result against the output schema", async () => {
    Nock(testBaseUrl)
      .get("/++api++/@search")
      .query(true)
      .reply(500, { message: "boom" });

    const { result } = await modernRequest("tools/call", {
      name: "plone_search",
      arguments: { query: "news" },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].text).not.toMatch(/output schema/i);
  });

  it("returns an array result as structured content unchanged", async () => {
    const types = [{ "@id": `${testBaseUrl}/@types/Document`, title: "Page" }];
    Nock(testBaseUrl).get("/++api++/@types").reply(200, types);

    const { result } = await modernRequest("tools/call", {
      name: "plone_get_types",
      arguments: {},
    });

    expect(result.structuredContent).toEqual(types);
  });

  it("runs a write tool", async () => {
    plone.mockContentUpdate(
      "/test-document",
      { title: "Renamed" },
      { ...sampleDocument, title: "Renamed" },
    );

    const { result } = await modernRequest("tools/call", {
      name: "plone_update_content",
      arguments: { path: "/test-document", title: "Renamed" },
    });

    expect(result.isError).toBeUndefined();
    expect(Nock.isDone()).toBe(true);
  });

  it("creates a page with blocks in one call", async () => {
    let sent: Record<string, any> = {};
    plone.mockContentCreate(
      "/",
      (body: Record<string, any>) => {
        sent = body;
        return true;
      },
      { ...sampleDocument, "@id": `${testBaseUrl}/new-page` },
    );

    const { result } = await modernRequest("tools/call", {
      name: "plone_create_content",
      arguments: {
        parentPath: "/",
        type: "Document",
        title: "New page",
        block_specs: [
          { type: "slate", data: { text: "Hello" } },
          { type: "separator", data: {} },
        ],
      },
    });

    expect(result.isError).toBeUndefined();
    const types = sent.blocks_layout.items.map(
      (id: string) => sent.blocks[id]["@type"],
    );
    expect(types).toEqual(["title", "slate", "separator"]);
  });

  it("reads a content resource", async () => {
    plone.mockContentGet("/test-document", sampleDocument);

    const { result } = await modernRequest("resources/read", {
      uri: "plone://content/test-document",
    });

    expect(JSON.parse(result.contents[0].text)).toEqual(sampleDocument);
  });
});
