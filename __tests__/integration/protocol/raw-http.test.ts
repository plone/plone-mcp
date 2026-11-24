import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handler } from "plone-mcp/handler";
import {
  MODERN_VERSION,
  httpRequest,
  modernHttpRequest,
  modernMeta,
} from "plone-mcp/__tests__/utils/mcp-request";

const toolsList = (headers: Record<string, string>, meta = modernMeta) =>
  httpRequest(
    { jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: meta } },
    headers,
  );

async function send(request: Request) {
  const response = await handler.fetch(request);
  return { status: response.status, headers: response.headers, body: await response.json() };
}

describe("raw HTTP", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["GET", "DELETE"])("answers %s with 405", async (method) => {
    const response = await handler.fetch(httpRequest(undefined, {}, method));

    expect(response.status).toBe(405);
  });

  it("rejects a request without Mcp-Method", async () => {
    const { status, body } = await send(
      toolsList({ "MCP-Protocol-Version": MODERN_VERSION }),
    );

    expect(status).toBe(400);
    expect(body.error.code).toBe(-32020);
  });

  it("rejects an Mcp-Name that does not match the body", async () => {
    const request = modernHttpRequest("tools/call", {
      name: "plone_get_content",
      arguments: { path: "/" },
    });
    request.headers.set("Mcp-Name", "plone_search");

    const { status, body } = await send(request);

    expect(status).toBe(400);
    expect(body.error.code).toBe(-32020);
  });

  it("rejects an unknown protocol version with the supported list", async () => {
    const { status, body } = await send(
      toolsList(
        { "MCP-Protocol-Version": "2099-01-01", "Mcp-Method": "tools/list" },
        {
          ...modernMeta,
          "io.modelcontextprotocol/protocolVersion": "2099-01-01",
        },
      ),
    );

    expect(status).toBe(400);
    expect(body.error.code).toBe(-32022);
    expect(body.error.data.supported).toEqual([MODERN_VERSION]);
  });

  it("rejects missing _meta protocol fields", async () => {
    const { status, body } = await send(
      toolsList(
        { "MCP-Protocol-Version": MODERN_VERSION, "Mcp-Method": "tools/list" },
        {
          "io.modelcontextprotocol/protocolVersion": MODERN_VERSION,
        } as typeof modernMeta,
      ),
    );

    expect(status).toBe(400);
    expect(body.error.code).toBe(-32602);
  });

  it("answers an unknown method with 404 and -32601", async () => {
    const { status, body } = await send(modernHttpRequest("plone/unknown"));

    expect(status).toBe(404);
    expect(body.error.code).toBe(-32601);
  });

  describe("Origin", () => {
    const withOrigin = (origin: string) => {
      const request = modernHttpRequest("tools/list");
      request.headers.set("Origin", origin);
      return handler.fetch(request);
    };

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("rejects a foreign Origin with 403", async () => {
      expect((await withOrigin("https://evil.example")).status).toBe(403);
      expect((await withOrigin("null")).status).toBe(403);
    });

    it.each(["http://localhost:6274", "http://127.0.0.1", "http://[::1]:3000"])(
      "allows the local page %s",
      async (origin) => {
        expect((await withOrigin(origin)).status).toBe(200);
      },
    );

    it("allows origins listed in PLONE_MCP_ALLOWED_ORIGINS", async () => {
      vi.stubEnv(
        "PLONE_MCP_ALLOWED_ORIGINS",
        "https://a.example, https://cms.example",
      );

      expect((await withOrigin("https://cms.example")).status).toBe(200);
      expect((await withOrigin("https://other.example")).status).toBe(403);
    });
  });

  it("serves a request carrying Mcp-Session-Id and echoes nothing", async () => {
    const request = modernHttpRequest("tools/list");
    request.headers.set("Mcp-Session-Id", "stale-session");

    const { status, headers, body } = await send(request);

    expect(status).toBe(200);
    expect(body.result.tools.length).toBeGreaterThan(0);
    expect(headers.get("Mcp-Session-Id")).toBeNull();
  });
});
