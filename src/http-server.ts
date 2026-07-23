import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { createServer } from "./server.js";
import { sessionManager } from "./session-manager.js";
import type { Request, Response } from "express";

/**
 * Entry point for the Plone MCP Server running over HTTP with stateful sessions.
 */

// createMcpExpressApp() already installs express.json() body parsing.
const app = createMcpExpressApp();

// Stateful session storage: sessionId -> transport
const transports = new Map<string, StreamableHTTPServerTransport>();

// POST handler - main MCP endpoint
app.post("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      // Reuse existing transport for session
      const existingTransport = transports.get(sessionId);
      if (!existingTransport) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Invalid session ID" },
          id: null,
        });
        return;
      }
      transport = existingTransport;
    } else if (!sessionId && req.body.method === "initialize") {
      // New session initialization
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          console.log(`Session initialized: ${sid}`);
          transports.set(sid, transport);
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          transports.delete(sid);
          sessionManager.clearSession(sid);
          console.log(`Session closed: ${sid}`);
        }
      };

      const server = createServer();
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Invalid or missing session ID" },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// GET handler - SSE stream for notifications
app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(400).send("Session not found");
    return;
  }
  await transport.handleRequest(req, res);
});

// DELETE handler - session termination
app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(400).send("Session not found");
    return;
  }
  await transport.handleRequest(req, res);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  sessionManager.startCleanup();
  console.log(`Plone MCP Server (HTTP) listening on port ${PORT}`);
});

// Graceful shutdown (SIGINT for local runs, SIGTERM for containers)
const shutdown = async () => {
  console.log("Shutting down...");
  for (const transport of transports.values()) {
    await transport.close();
  }
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
