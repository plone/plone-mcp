import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handler } from "plone-mcp/handler";
import { Nock, sampleDocument } from "plone-mcp/__tests__/utils/test-helpers";
import { httpRequest, readMessage } from "plone-mcp/__tests__/utils/mcp-request";

const testBaseUrl = "http://localhost:8080/Plone";
const LEGACY_VERSION = "2025-11-25";

async function legacyRequest(
  method: string,
  params?: Record<string, unknown>,
) {
  const response = await handler.fetch(
    httpRequest(
      { jsonrpc: "2.0", id: 1, method, params },
      method === "initialize" ? {} : { "MCP-Protocol-Version": LEGACY_VERSION },
    ),
  );
  return { response, message: await readMessage(response) };
}

describe("2025-era clients over HTTP", () => {
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

  it("initializes without issuing a session id", async () => {
    const { response, message } = await legacyRequest("initialize", {
      protocolVersion: LEGACY_VERSION,
      capabilities: {},
      clientInfo: { name: "legacy-client", version: "0.0.0" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Mcp-Session-Id")).toBeNull();
    expect(message.result.protocolVersion).toBe(LEGACY_VERSION);
  });

  it("lists tools without cache fields", async () => {
    const { message } = await legacyRequest("tools/list");

    expect(message.result.tools.length).toBeGreaterThan(0);
    expect(message.result).not.toHaveProperty("ttlMs");
    expect(message.result).not.toHaveProperty("cacheScope");
    expect(message.result).not.toHaveProperty("resultType");
  });

  it("calls a tool", async () => {
    Nock(testBaseUrl).get("/++api++/test-document").reply(200, sampleDocument);

    const { message } = await legacyRequest("tools/call", {
      name: "plone_get_content",
      arguments: { path: "/test-document" },
    });

    expect(JSON.parse(message.result.content[0].text)).toEqual(sampleDocument);
    expect(message.result.structuredContent).toEqual(sampleDocument);
  });

  it("wraps an array result, as 2025 structured content must be an object", async () => {
    const types = [{ "@id": `${testBaseUrl}/@types/Document`, title: "Page" }];
    Nock(testBaseUrl).get("/++api++/@types").reply(200, types);

    const { message } = await legacyRequest("tools/call", {
      name: "plone_get_types",
      arguments: {},
    });

    expect(message.result.structuredContent).toEqual({ result: types });
    expect(JSON.parse(message.result.content[0].text)).toEqual(types);
  });
});
