import {
  createMcpHandler,
  isLegacyRequest,
  type McpHandlerRequestOptions,
} from "@modelcontextprotocol/server";
import { createServer } from "./server.js";

export const ENV_ALLOWED_ORIGINS = "PLONE_MCP_ALLOWED_ORIGINS";

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Browsers send an Origin; other clients do not. Only local pages and the
 * origins listed in PLONE_MCP_ALLOWED_ORIGINS (comma-separated) may call the
 * server from a browser, which blocks DNS rebinding.
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) {
    return true;
  }
  const allowed = (process.env[ENV_ALLOWED_ORIGINS] ?? "")
    .split(",")
    .map((entry) => entry.trim());
  if (allowed.includes(origin)) {
    return true;
  }
  try {
    return LOCAL_HOSTNAMES.includes(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/**
 * Web-standard MCP handler (Request -> Response). Every request gets a fresh
 * server from the factory, so any instance can answer any request.
 */
const mcpHandler = createMcpHandler(() => createServer(), {
  legacy: "stateless",
  responseMode: "json",
  onerror: (error) => console.error(`MCP request error: ${error.message}`),
});

export const handler = {
  fetch: async (request: Request, options?: McpHandlerRequestOptions) => {
    const origin = request.headers.get("Origin");
    if (!isAllowedOrigin(origin)) {
      return new Response(`Origin not allowed: ${origin}`, { status: 403 });
    }
    // Lets operators see when 2025-era traffic has stopped.
    const legacy = await isLegacyRequest(request.clone(), options?.parsedBody);
    console.error(`MCP request: ${legacy ? "legacy" : "modern"}`);
    return mcpHandler.fetch(request, options);
  },
  close: () => mcpHandler.close(),
};
