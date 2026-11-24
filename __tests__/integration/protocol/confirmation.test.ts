import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { handler } from "plone-mcp/handler";
import {
  Nock,
  PloneMockServer,
} from "plone-mcp/__tests__/utils/test-helpers";
import {
  MODERN_VERSION,
  httpRequest,
  modernRequest,
  readMessage,
} from "plone-mcp/__tests__/utils/mcp-request";

const testBaseUrl = "http://localhost:8080/Plone";
const CAPABILITIES = "io.modelcontextprotocol/clientCapabilities";
const canAsk = { [CAPABILITIES]: { elicitation: { form: {} } } };
const accepted = { confirm: { action: "accept", content: { confirm: true } } };

function deleteNews(params: Record<string, unknown> = {}, path = "/news") {
  return modernRequest("tools/call", {
    name: "plone_delete_content",
    arguments: { path },
    _meta: canAsk,
    ...params,
  });
}

describe("confirmation of destructive tools", () => {
  let plone: PloneMockServer;

  beforeEach(() => {
    vi.spyOn(console, "error").mockReturnValue(undefined);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
    vi.stubEnv("PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP", "true");
    vi.stubEnv(
      "PLONE_MCP_STATE_SECRET",
      "a-test-secret-that-is-at-least-32-bytes",
    );
    plone = new PloneMockServer(testBaseUrl);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    Nock.cleanAll();
  });

  it("asks before deleting, naming the item and its contents", async () => {
    plone.mockContentGet("/news", { title: "News", items_total: 14 });

    const { result } = await deleteNews();

    expect(result.resultType).toBe("input_required");
    expect(result.inputRequests.confirm.params.message).toBe(
      'Delete "News" (/news)? It contains 14 item(s), which are deleted with it. This cannot be undone.',
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("deletes once the user confirmed", async () => {
    plone.mockContentGet("/news", { title: "News" });
    const { result: asked } = await deleteNews();
    plone.mockContentDelete("/news");

    const { result } = await deleteNews({
      requestState: asked.requestState,
      inputResponses: accepted,
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ path: "/news", deleted: true });
    expect(Nock.isDone()).toBe(true);
  });

  it("does not delete when the user declined", async () => {
    plone.mockContentGet("/news", { title: "News" });
    const { result: asked } = await deleteNews();
    const deleted = plone.mockContentDelete("/news");

    const { result } = await deleteNews({
      requestState: asked.requestState,
      inputResponses: { confirm: { action: "decline" } },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("did not confirm");
    expect(deleted.isDone()).toBe(false);
  });

  it("refuses a confirmation replayed for another path", async () => {
    plone.mockContentGet("/news", { title: "News" });
    const { result: asked } = await deleteNews();
    const deleted = plone.mockContentDelete("/");

    const { result } = await deleteNews(
      { requestState: asked.requestState, inputResponses: accepted },
      "/",
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("different action");
    expect(deleted.isDone()).toBe(false);
  });

  it("does not ask about content that does not exist", async () => {
    Nock(testBaseUrl).get("/++api++/missing").reply(404, {});

    const { result } = await deleteNews({}, "/missing");

    expect(result.isError).toBe(true);
    expect(result.resultType).toBe("complete");
  });

  it("asks before discarding a working copy", async () => {
    plone.mockContentGet("/about", { title: "About us" });

    const { result } = await modernRequest("tools/call", {
      name: "plone_cancel_working_copy",
      arguments: { path: "/about" },
      _meta: canAsk,
    });

    expect(result.inputRequests.confirm.params.message).toBe(
      'Discard the working copy of "About us" (/about)? All changes made in it are lost.',
    );
  });

  describe("client that cannot ask the user", () => {
    it("deletes without asking by default", async () => {
      plone.mockContentDelete("/news");

      const { result } = await deleteNews({ _meta: {} });

      expect(result.isError).toBeUndefined();
      expect(Nock.isDone()).toBe(true);
    });

    it("refuses in required mode", async () => {
      vi.stubEnv("PLONE_MCP_CONFIRM_DESTRUCTIVE", "required");
      const deleted = plone.mockContentDelete("/news");

      const { result } = await deleteNews({ _meta: {} });

      expect(result.isError).toBe(true);
      expect(deleted.isDone()).toBe(false);
    });

    it("deletes without asking for a 2025 client over HTTP", async () => {
      plone.mockContentDelete("/news");

      const message = await readMessage(
        await handler.fetch(
          httpRequest(
            {
              jsonrpc: "2.0",
              id: 1,
              method: "tools/call",
              params: {
                name: "plone_delete_content",
                arguments: { path: "/news" },
              },
            },
            { "MCP-Protocol-Version": "2025-11-25" },
          ),
        ),
      );

      expect(message.result.isError).toBeUndefined();
      expect(Nock.isDone()).toBe(true);
    });
  });

  it("does not ask when confirmation is off", async () => {
    vi.stubEnv("PLONE_MCP_CONFIRM_DESTRUCTIVE", "off");
    plone.mockContentDelete("/news");

    const { result } = await deleteNews();

    expect(result.isError).toBeUndefined();
    expect(Nock.isDone()).toBe(true);
  });

  describe("with the SDK client", () => {
    let client: Client | undefined;

    afterEach(async () => {
      await client?.close();
      client = undefined;
    });

    async function connect(answer: "accept" | "decline") {
      const messages: string[] = [];
      client = new Client(
        { name: "test-client", version: "0.0.0" },
        {
          capabilities: { elicitation: { form: {} } },
          versionNegotiation: { mode: { pin: MODERN_VERSION } },
        },
      );
      client.setRequestHandler("elicitation/create", async (request) => {
        messages.push(request.params.message);
        return answer === "accept"
          ? { action: "accept", content: { confirm: true } }
          : { action: "decline" };
      });
      await client.connect(
        new StreamableHTTPClientTransport(new URL("http://localhost/mcp"), {
          fetch: (url, init) => handler.fetch(new Request(url, init)),
        }),
      );
      return messages;
    }

    it("deletes after the user accepts", async () => {
      plone.mockContentGet("/news", { title: "News" });
      plone.mockContentDelete("/news");
      const messages = await connect("accept");

      const result = await client!.callTool({
        name: "plone_delete_content",
        arguments: { path: "/news" },
      });

      expect(messages).toEqual([
        'Delete "News" (/news)? This cannot be undone.',
      ]);
      expect(result.isError).toBeFalsy();
      expect(Nock.isDone()).toBe(true);
    });

    it("keeps the content after the user declines", async () => {
      plone.mockContentGet("/news", { title: "News" });
      const deleted = plone.mockContentDelete("/news");
      await connect("decline");

      const result = await client!.callTool({
        name: "plone_delete_content",
        arguments: { path: "/news" },
      });

      expect(result.isError).toBe(true);
      expect(deleted.isDone()).toBe(false);
    });
  });
});
