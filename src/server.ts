import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

const { version } = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../package.json", import.meta.url)),
    "utf-8",
  ),
) as { version: string };

// Lists only change on redeploy and are the same for every caller; content
// reads are live and depend on the caller's credentials.
const LIST_CACHE_HINT = { ttlMs: 60 * 60 * 1000, cacheScope: "public" } as const;

/**
 * Creates and configures a new McpServer instance.
 */
export function createServer() {
  const server = new McpServer(
    {
      name: "plone-mcp-server",
      version,
    },
    {
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
        prompts: { listChanged: false },
      },
      cacheHints: {
        "server/discover": LIST_CACHE_HINT,
        "tools/list": LIST_CACHE_HINT,
        "prompts/list": LIST_CACHE_HINT,
        "resources/list": LIST_CACHE_HINT,
        "resources/templates/list": LIST_CACHE_HINT,
        "resources/read": { ttlMs: 0, cacheScope: "private" },
      },
    },
  );

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}
