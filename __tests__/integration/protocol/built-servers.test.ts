import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import {
  MODERN_VERSION,
  modernMeta,
} from "plone-mcp/__tests__/utils/mcp-request";

// These run the compiled entry points; CI builds before testing.
const dist = path.resolve(__dirname, "../../../dist");
const stdioServer = path.join(dist, "stdio-server.js");
const httpServer = path.join(dist, "http-server.js");
const env = { ...process.env, PLONE_BASE_URL: "http://localhost:8080/Plone" };

const modernMessage = (id: number | string, method: string) =>
  JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    params: { _meta: modernMeta },
  }) + "\n";

describe.skipIf(!existsSync(stdioServer))("built stdio server", () => {
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close();
    client = undefined;
  });

  it.each([
    [{ mode: { pin: MODERN_VERSION } }, "modern"],
    [undefined, "legacy"],
  ] as const)("serves an SDK client (%j)", async (versionNegotiation, era) => {
    client = new Client(
      { name: "test-client", version: "0.0.0" },
      { versionNegotiation },
    );
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [stdioServer],
        env,
        stderr: "ignore",
      }),
    );

    expect(client.getProtocolEra()).toBe(era);
    expect((await client.listTools()).tools.length).toBeGreaterThan(0);
  });

  it("answers interleaved requests, then exits when stdin closes", async () => {
    const child = spawn(process.execPath, [stdioServer], {
      env,
      stdio: ["pipe", "pipe", "ignore"],
    });
    const responses = new Map<string, any>();
    createInterface({ input: child.stdout }).on("line", (line) => {
      const message = JSON.parse(line);
      responses.set(String(message.id), message);
    });

    child.stdin.write(modernMessage("a-1", "server/discover"));
    child.stdin.write(modernMessage("b-1", "tools/list"));
    child.stdin.write(modernMessage("a-2", "prompts/list"));
    child.stdin.write(modernMessage("b-2", "resources/list"));
    child.stdin.end();
    const [code] = await once(child, "exit");

    expect(code).toBe(0);
    expect(responses.get("a-1").result.supportedVersions).toContain(
      MODERN_VERSION,
    );
    expect(responses.get("b-1").result.tools.length).toBeGreaterThan(0);
    expect(responses.get("a-2").result.prompts.length).toBeGreaterThan(0);
    expect(responses.get("b-2").result.resources.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!existsSync(httpServer))("built HTTP server", () => {
  let child: ChildProcess | undefined;

  afterEach(async () => {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
    child = undefined;
  });

  async function start() {
    const port = String(20000 + Math.floor(Math.random() * 20000));
    child = spawn(process.execPath, [httpServer], {
      env: { ...env, PORT: port },
      stdio: ["ignore", "pipe", "ignore"],
    });
    const lines = createInterface({ input: child.stdout! });
    for await (const line of lines) {
      if (line.includes("listening")) break;
    }
    return `http://127.0.0.1:${port}/mcp`;
  }

  const post = (url: string, headers: Record<string, string> = {}) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": MODERN_VERSION,
        "Mcp-Method": "tools/list",
        ...headers,
      },
      body: modernMessage(1, "tools/list"),
    });

  it("serves a modern request and rejects a foreign Origin", async () => {
    const url = await start();

    const ok = await post(url);
    const foreign = await post(url, { Origin: "https://evil.example" });

    expect(ok.status).toBe(200);
    expect((await ok.json()).result.tools.length).toBeGreaterThan(0);
    expect(foreign.status).toBe(403);
  });

  it("shuts down on SIGTERM", async () => {
    await start();

    child!.kill("SIGTERM");
    const [code] = await once(child!, "exit");

    expect(code).toBe(0);
  });
});
