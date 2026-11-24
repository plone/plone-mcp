import express from "express";
import { localhostHostValidation } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { handler } from "./handler.js";

/**
 * Entry point for the Plone MCP Server running over HTTP. Stateless: no
 * sessions, every request is served on its own.
 */

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT) || 3001;

const app = express();
// The handler checks Origin; a localhost bind also checks Host, which blocks
// DNS rebinding.
if (["127.0.0.1", "localhost", "::1"].includes(HOST)) {
  app.use(localhostHostValidation());
}
app.all("/mcp", toNodeHandler(handler));

const httpServer = app.listen(PORT, HOST, () => {
  console.log(`Plone MCP Server (HTTP) listening on http://${HOST}:${PORT}/mcp`);
});

// Graceful shutdown (SIGINT for local runs, SIGTERM for containers)
const shutdown = async () => {
  console.log("Shutting down...");
  httpServer.close();
  await handler.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
