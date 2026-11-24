#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";
import { ENV_STATE_SECRET } from "./confirmation.js";

/**
 * Entry point for the Plone MCP Server running over STDIO.
 */

// One process serves every round of a confirmation, so a random key works
// when none is configured.
const stateKey = process.env[ENV_STATE_SECRET] || randomBytes(32);

try {
  serveStdio(() => createServer({ stateKey }), {
    onerror: (error) => console.error(`MCP request error: ${error.message}`),
  });
  console.error("Plone MCP Server (STDIO) started");
} catch (error) {
  console.error("Fatal error in STDIO server:", error);
  process.exit(1);
}
