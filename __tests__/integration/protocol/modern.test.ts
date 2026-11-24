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
    expect(Nock.isDone()).toBe(true);
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
