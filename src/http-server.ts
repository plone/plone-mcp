import express from "express";
import { localhostHostValidation } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { readHttpAuth } from "./auth/http-auth.js";
import { handler } from "./handler.js";

/**
 * Entry point for the Plone MCP Server running over HTTP. Stateless: no
 * sessions, every request is served on its own.
 */

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT) || 3001;

// Refuse to start rather than serve an endpoint nobody signs in to.
try {
  readHttpAuth();
} catch (error) {
  console.error(`Plone MCP Server (HTTP) not started: ${(error as Error).message}`);
  process.exit(1);
}

const app = express();
// The handler checks Origin; a localhost bind also checks Host, which blocks
// DNS rebinding.
if (["127.0.0.1", "localhost", "::1"].includes(HOST)) {
  app.use(localhostHostValidation());
}
app.all(
  ["/mcp", "/.well-known/oauth-protected-resource{/*path}"],
  toNodeHandler(handler),
);

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
