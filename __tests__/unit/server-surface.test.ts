import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { registerTools } from "plone-mcp/tools/index";
import { registerResources } from "plone-mcp/resources/index";
import { registerPrompts } from "plone-mcp/prompts/index";
import { createServer } from "plone-mcp/server";
import { Nock } from "plone-mcp/__tests__/utils/test-helpers";
import { modernRequest } from "plone-mcp/__tests__/utils/mcp-request";
import packageJson from "../../package.json";

type Server = Parameters<typeof registerTools>[0];

function toJsonSchema(schema: unknown) {
  return z.toJSONSchema(
    schema instanceof z.ZodType
      ? schema
      : z.object(schema as Record<string, z.ZodType>),
  );
}

function collectSurface() {
  const registerTool = vi.fn();
  const registerResource = vi.fn();
  const registerPrompt = vi.fn();
  const server = {
    registerTool,
    registerResource,
    registerPrompt,
  } as unknown as Server;

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return {
    tools: registerTool.mock.calls.map(([name, config]) => ({
      name,
      description: config.description,
      annotations: config.annotations,
      inputSchema: toJsonSchema(config.inputSchema),
    })),
    resources: registerResource.mock.calls.map(([name, uri, metadata]) => ({
      name,
      uri: typeof uri === "string" ? uri : uri.uriTemplate.toString(),
      ...metadata,
    })),
    prompts: registerPrompt.mock.calls.map(([name, config]) => ({
      name,
      description: config.description,
      argsSchema: toJsonSchema(config.argsSchema),
    })),
  };
}

describe("server surface", () => {
  it("registers the expected tools, in order", () => {
    const { tools } = collectSurface();

    expect(tools.map((tool) => tool.name)).toMatchSnapshot();
  });

  it("uses tool names that never need encoding in the Mcp-Name header", () => {
    for (const { name } of collectSurface().tools) {
      expect(name).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
    }
  });

  describe("over 2026-07-28", () => {
    beforeEach(() => {
      // The handler logs the protocol era of every request.
      vi.spyOn(console, "error").mockReturnValue(undefined);
      vi.stubEnv("PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP", "true");
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    });

    it("lists tools in the same order on every fresh server", async () => {
      const names = async () =>
        (await modernRequest("tools/list")).result.tools.map(
          (tool: { name: string }) => tool.name,
        );

      expect(await names()).toEqual(await names());
    });

    it("marks lists as cacheable for an hour by anyone", async () => {
      for (const method of [
        "server/discover",
        "tools/list",
        "prompts/list",
        "resources/list",
        "resources/templates/list",
      ]) {
        expect((await modernRequest(method)).result).toMatchObject({
          resultType: "complete",
          ttlMs: 3600000,
          cacheScope: "public",
        });
      }
    });

    it("never lets content reads be cached", async () => {
      vi.stubEnv("PLONE_BASE_URL", "https://test.plone.com");
      Nock("https://test.plone.com")
        .get("/++api++")
        .reply(200, { id: "plone" });

      const { result } = await modernRequest("resources/read", {
        uri: "plone://site",
      });

      expect(result).toMatchObject({ ttlMs: 0, cacheScope: "private" });
      expect(result.contents).toHaveLength(1);
    });
  });

  it("keeps every tool's description, annotations and input schema", () => {
    for (const tool of collectSurface().tools) {
      expect(tool).toMatchSnapshot(tool.name);
    }
  });

  it("registers the expected resources", () => {
    expect(collectSurface().resources).toMatchSnapshot();
  });

  it("registers the expected prompts", () => {
    expect(collectSurface().prompts).toMatchSnapshot();
  });

  it("advertises the package version and fixed lists", async () => {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const response = new Promise<any>((resolve) => {
      clientTransport.onmessage = resolve;
    });

    await createServer().connect(serverTransport);
    await clientTransport.start();
    await clientTransport.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.0.0" },
      },
    });

    const { result } = await response;
    expect(result.serverInfo).toEqual({
      name: "plone-mcp-server",
      version: packageJson.version,
    });
    expect(result.capabilities).toEqual({
      tools: { listChanged: false },
      resources: { listChanged: false },
      prompts: { listChanged: false },
    });
  });
});
