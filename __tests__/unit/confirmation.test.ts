import { describe, it, expect, vi, afterEach } from "vitest";
import {
  confirmMode,
  createConfirmationCodec,
  withConfirmation,
  type ConfirmMode,
} from "plone-mcp/confirmation";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";

const KEY = "a-test-secret-that-is-at-least-32-bytes";
const CAPABILITIES = "io.modelcontextprotocol/clientCapabilities";

interface CtxOptions {
  capabilities?: Record<string, unknown>;
  legacy?: boolean;
  requestState?: unknown;
  inputResponses?: Record<string, unknown>;
  userId?: string;
}

function makeCtx({
  capabilities = {},
  legacy = false,
  requestState,
  inputResponses,
  userId,
}: CtxOptions = {}) {
  return {
    mcpReq: {
      ...(!legacy && { envelope: { [CAPABILITIES]: capabilities } }),
      inputResponses,
      requestState: () => requestState,
    },
    ...(userId && { http: { authInfo: { extra: { userId } } } }),
  } as unknown as ServerContext;
}

function makeServer(capabilities?: Record<string, unknown>) {
  return {
    server: { getClientCapabilities: () => capabilities },
  } as unknown as McpServer;
}

const confirmation = {
  operation: (args: { path: string }) => `delete\0${args.path}`,
  message: async (args: { path: string }) => `Delete ${args.path}?`,
};

function setup(mode: ConfirmMode = "when-supported", withCodec = true) {
  const handler = vi.fn(async (_args: { path: string }, _ctx: ServerContext) => ({
    content: [{ type: "text" as const, text: "done" }],
  }));
  const codec = withCodec ? createConfirmationCodec(KEY) : undefined;
  const guarded = withConfirmation(handler, confirmation, {
    server: makeServer(),
    codec,
    mode,
  });
  return { handler, guarded, codec };
}

const accepted = { confirm: { action: "accept", content: { confirm: true } } };

describe("confirmMode", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to when-supported", () => {
    expect(confirmMode()).toBe("when-supported");
  });

  it.each(["off", "when-supported", "required"])("accepts %s", (mode) => {
    vi.stubEnv("PLONE_MCP_CONFIRM_DESTRUCTIVE", mode);
    expect(confirmMode()).toBe(mode);
  });

  it("refuses an unknown mode", () => {
    vi.stubEnv("PLONE_MCP_CONFIRM_DESTRUCTIVE", "always");
    expect(() => confirmMode()).toThrow("PLONE_MCP_CONFIRM_DESTRUCTIVE");
  });
});

describe("createConfirmationCodec", () => {
  afterEach(() => vi.useRealTimers());

  it("round-trips the pending operation", async () => {
    const codec = createConfirmationCodec(KEY);
    const ctx = makeCtx({ userId: "editor" });
    const state = await codec.mint({ operation: "delete\0/news" }, ctx);

    await expect(codec.verify(state, ctx)).resolves.toEqual({
      operation: "delete\0/news",
    });
  });

  it("refuses a tampered state", async () => {
    const codec = createConfirmationCodec(KEY);
    const ctx = makeCtx();
    const state = await codec.mint({ operation: "delete\0/news" }, ctx);
    const [version, body, mac] = state.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    payload.p.operation = "delete\0/";
    const forged = `${version}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${mac}`;

    await expect(codec.verify(forged, ctx)).rejects.toThrow();
  });

  it("refuses a state minted for another user", async () => {
    const codec = createConfirmationCodec(KEY);
    const state = await codec.mint(
      { operation: "delete\0/news" },
      makeCtx({ userId: "editor" }),
    );

    await expect(
      codec.verify(state, makeCtx({ userId: "someone-else" })),
    ).rejects.toThrow();
  });

  it("refuses an expired state", async () => {
    vi.useFakeTimers();
    const codec = createConfirmationCodec(KEY);
    const ctx = makeCtx();
    const state = await codec.mint({ operation: "delete\0/news" }, ctx);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

    await expect(codec.verify(state, ctx)).rejects.toThrow();
  });

  it("refuses a state signed with another key", async () => {
    const ctx = makeCtx();
    const state = await createConfirmationCodec(KEY).mint(
      { operation: "delete\0/news" },
      ctx,
    );

    await expect(
      createConfirmationCodec(`${KEY}-other`).verify(state, ctx),
    ).rejects.toThrow();
  });
});

describe("withConfirmation", () => {
  it("asks a client that supports elicitation, without running the action", async () => {
    const { handler, guarded } = setup();

    const result = await guarded(
      { path: "/news" },
      makeCtx({ capabilities: { elicitation: { form: {} } } }),
    );

    expect(handler).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      resultType: "input_required",
      inputRequests: {
        confirm: {
          method: "elicitation/create",
          params: { mode: "form", message: "Delete /news?" },
        },
      },
    });
    expect(typeof (result as { requestState?: unknown }).requestState).toBe(
      "string",
    );
  });

  it("treats an empty elicitation capability as form support", async () => {
    const { handler, guarded } = setup();

    await guarded(
      { path: "/news" },
      makeCtx({ capabilities: { elicitation: {} } }),
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the action once the user confirmed", async () => {
    const { handler, guarded } = setup();

    await guarded(
      { path: "/news" },
      makeCtx({
        requestState: { operation: "delete\0/news" },
        inputResponses: accepted,
      }),
    );

    expect(handler).toHaveBeenCalledOnce();
  });

  it.each([
    ["declined", { confirm: { action: "decline" } }],
    ["cancelled", { confirm: { action: "cancel" } }],
    ["accepted without ticking the box", { confirm: { action: "accept", content: { confirm: false } } }],
    ["missing", {}],
  ])("does not run the action when the answer is %s", async (_, inputResponses) => {
    const { handler, guarded } = setup();

    await expect(
      guarded(
        { path: "/news" },
        makeCtx({ requestState: { operation: "delete\0/news" }, inputResponses }),
      ),
    ).rejects.toThrow("did not confirm");
    expect(handler).not.toHaveBeenCalled();
  });

  it("refuses a confirmation given for another operation", async () => {
    const { handler, guarded } = setup();

    await expect(
      guarded(
        { path: "/" },
        makeCtx({
          requestState: { operation: "delete\0/news" },
          inputResponses: accepted,
        }),
      ),
    ).rejects.toThrow("different action");
    expect(handler).not.toHaveBeenCalled();
  });

  it("refuses an unverified raw requestState", async () => {
    const { handler, guarded } = setup();

    await expect(
      guarded(
        { path: "/news" },
        makeCtx({ requestState: "v1.forged.state", inputResponses: accepted }),
      ),
    ).rejects.toThrow("different action");
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the action without asking when the mode is off", async () => {
    const { handler, guarded } = setup("off");

    await guarded(
      { path: "/news" },
      makeCtx({ capabilities: { elicitation: {} } }),
    );

    expect(handler).toHaveBeenCalledOnce();
  });

  describe("client that cannot ask the user", () => {
    it("runs the action in when-supported mode", async () => {
      const { handler, guarded } = setup("when-supported");

      await guarded({ path: "/news" }, makeCtx());

      expect(handler).toHaveBeenCalledOnce();
    });

    it("refuses the action in required mode", async () => {
      const { handler, guarded } = setup("required");

      await expect(guarded({ path: "/news" }, makeCtx())).rejects.toThrow(
        "cannot ask the user",
      );
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("without a signing key", () => {
    const ctx = makeCtx({ capabilities: { elicitation: {} } });

    it("runs the action in when-supported mode", async () => {
      const { handler, guarded } = setup("when-supported", false);

      await guarded({ path: "/news" }, ctx);

      expect(handler).toHaveBeenCalledOnce();
    });

    it("refuses the action in required mode", async () => {
      const { handler, guarded } = setup("required", false);

      await expect(guarded({ path: "/news" }, ctx)).rejects.toThrow(
        "PLONE_MCP_STATE_SECRET",
      );
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("2025 connection", () => {
    it("asks when the client declared elicitation at initialize", async () => {
      const handler = vi.fn(
        async (_args: { path: string }, _ctx: ServerContext) => ({
          content: [],
        }),
      );
      const guarded = withConfirmation(handler, confirmation, {
        server: makeServer({ elicitation: {} }),
        codec: createConfirmationCodec(KEY),
        mode: "when-supported",
      });

      const result = await guarded({ path: "/news" }, makeCtx({ legacy: true }));

      expect(handler).not.toHaveBeenCalled();
      expect(result).toMatchObject({ resultType: "input_required" });
    });

    it("runs the action on stateless HTTP, where nothing was declared", async () => {
      const { handler, guarded } = setup();

      await guarded({ path: "/news" }, makeCtx({ legacy: true }));

      expect(handler).toHaveBeenCalledOnce();
    });
  });
});
