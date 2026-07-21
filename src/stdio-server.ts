import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

/**
 * Entry point for the Plone MCP Server running over STDIO.
 */

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  console.error("Plone MCP Server (STDIO) started");
}

main().catch((error) => {
  console.error("Fatal error in STDIO server:", error);
  process.exit(1);
});
