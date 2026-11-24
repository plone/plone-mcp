#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";

/**
 * Entry point for the Plone MCP Server running over STDIO.
 */

try {
  serveStdio(() => createServer(), {
    onerror: (error) => console.error(`MCP request error: ${error.message}`),
  });
  console.error("Plone MCP Server (STDIO) started");
} catch (error) {
  console.error("Fatal error in STDIO server:", error);
  process.exit(1);
}
