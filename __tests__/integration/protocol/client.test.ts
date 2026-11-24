import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Client,
  StreamableHTTPClientTransport,
  type VersionNegotiationOptions,
} from "@modelcontextprotocol/client";
import { handler } from "plone-mcp/handler";
import {
  Nock,
  PloneMockServer,
  sampleDocument,
} from "plone-mcp/__tests__/utils/test-helpers";
import { MODERN_VERSION } from "plone-mcp/__tests__/utils/mcp-request";

const testBaseUrl = "http://localhost:8080/Plone";

async function connect(versionNegotiation?: VersionNegotiationOptions) {
  const client = new Client(
    { name: "test-client", version: "0.0.0" },
    { versionNegotiation },
  );
  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost/mcp"),
    { fetch: (url, init) => handler.fetch(new Request(url, init)) },
  );
  await client.connect(transport);
  return client;
}

describe("SDK client over HTTP", () => {
  let client: Client | undefined;

  beforeEach(() => {
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
    vi.stubEnv("PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP", "true");
  });

  afterEach(async () => {
    await client?.close();
    client = undefined;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    Nock.cleanAll();
  });

  describe.each<[string, VersionNegotiationOptions | undefined, string]>([
    ["pinned to 2026-07-28", { mode: { pin: MODERN_VERSION } }, "modern"],
    ["negotiating", { mode: "auto" }, "modern"],
    ["in the default legacy mode", undefined, "legacy"],
  ])("%s", (_, negotiation, era) => {
    it(`speaks the ${era} era`, async () => {
      client = await connect(negotiation);

      expect(client.getProtocolEra()).toBe(era);
      expect(client.getServerVersion()?.name).toBe("plone-mcp-server");
    });

    it("lists tools, calls one and reads a resource", async () => {
      const plone = new PloneMockServer(testBaseUrl);
      plone.mockContentGet("/test-document", sampleDocument);
      plone.mockContentGet("/test-document", sampleDocument);
      client = await connect(negotiation);

      const { tools } = await client.listTools();
      const called = await client.callTool({
        name: "plone_get_content",
        arguments: { path: "/test-document" },
      });
      const read = await client.readResource({
        uri: "plone://content/test-document",
      });

      expect(tools.map((tool) => tool.name)).toContain("plone_get_content");
      expect(called.isError).toBeFalsy();
      expect(read.contents[0]).toMatchObject({
        uri: "plone://content/test-document",
      });
      expect(Nock.isDone()).toBe(true);
    });
  });
});
