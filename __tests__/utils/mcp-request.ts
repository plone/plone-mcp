import {
  createMcpHandler,
  type AuthInfo,
} from "@modelcontextprotocol/server";
import { handler } from "plone-mcp/handler";
import { createServer } from "plone-mcp/server";

type FetchHandler = Pick<typeof handler, "fetch">;

export const MODERN_VERSION = "2026-07-28";

export const modernMeta = {
  "io.modelcontextprotocol/protocolVersion": MODERN_VERSION,
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    name: "test-client",
    version: "0.0.0",
  },
};

/** A brand-new handler, as on a cold serverless instance. */
export const freshHandler = (): FetchHandler =>
  createMcpHandler(() => createServer(), { responseMode: "json" });

export function httpRequest(
  body: unknown,
  headers: Record<string, string> = {},
  method = "POST",
) {
  return new Request("http://localhost/mcp", {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

/** A 2026-07-28 request with the headers and `_meta` the spec requires. */
export function modernHttpRequest(
  method: string,
  params: Record<string, unknown> = {},
  id: number | string = 1,
) {
  const name = params.name ?? params.uri;
  return httpRequest(
    {
      jsonrpc: "2.0",
      id,
      method,
      params: {
        ...params,
        _meta: { ...modernMeta, ...(params._meta as Record<string, unknown>) },
      },
    },
    {
      "MCP-Protocol-Version": MODERN_VERSION,
      "Mcp-Method": method,
      ...(typeof name === "string" && { "Mcp-Name": name }),
    },
  );
}

/**
 * Sends one 2026-07-28 request through an HTTP handler and returns the
 * parsed JSON-RPC response.
 */
export async function modernRequest(
  method: string,
  params: Record<string, unknown> = {},
  { target = handler, authInfo }: { target?: FetchHandler; authInfo?: AuthInfo } = {},
) {
  const response = await target.fetch(modernHttpRequest(method, params), {
    authInfo,
  });
  return response.json();
}

/** Reads a single JSON-RPC message from a JSON or SSE response. */
export async function readMessage(response: Response) {
  const text = await response.text();
  const data = text.startsWith("{")
    ? text
    : text
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice("data: ".length);
  return JSON.parse(data ?? "null");
}
