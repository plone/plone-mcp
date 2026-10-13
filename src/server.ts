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
    },
  );

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}
