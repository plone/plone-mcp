import {
  acceptedContent,
  createRequestStateCodec,
  inputRequired,
  type CallToolResult,
  type ClientCapabilities,
  type McpServer,
  type RequestStateCodec,
  type ServerContext,
} from "@modelcontextprotocol/server";
import { z } from "zod";

export const ENV_STATE_SECRET = "PLONE_MCP_STATE_SECRET";
export const ENV_CONFIRM_DESTRUCTIVE = "PLONE_MCP_CONFIRM_DESTRUCTIVE";

const MODES = ["off", "when-supported", "required"] as const;
export type ConfirmMode = (typeof MODES)[number];

const CONFIRMATION_TTL_SECONDS = 5 * 60;
const CONFIRM_KEY = "confirm";
const CLIENT_CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities";

const confirmSchema = z.object({ confirm: z.literal(true) });

/** What the signed requestState carries between the two round trips. */
interface Pending {
  operation: string;
}

export type ConfirmationCodec = RequestStateCodec<Pending>;

/**
 * Describes a destructive action to the user before it runs.
 */
export interface Confirmation<Args> {
  /**
   * Identifies the exact action, such as tool name and path. A confirmation
   * given for one operation is refused for another.
   */
  operation: (args: Args) => string;
  /** The question shown to the user. */
  message: (args: Args, ctx: ServerContext) => Promise<string>;
}

export interface ConfirmationSettings {
  server: McpServer;
  codec?: ConfirmationCodec;
  mode: ConfirmMode;
}

/**
 * Reads PLONE_MCP_CONFIRM_DESTRUCTIVE; `when-supported` when unset.
 */
export function confirmMode(): ConfirmMode {
  const value = process.env[ENV_CONFIRM_DESTRUCTIVE] ?? "when-supported";
  if (!(MODES as readonly string[]).includes(value)) {
    throw new Error(
      `${ENV_CONFIRM_DESTRUCTIVE} must be one of ${MODES.join(", ")}, not "${value}".`,
    );
  }
  return value as ConfirmMode;
}

/**
 * Signs the requestState of a confirmation round trip. The state goes through
 * the client, so it is bound to the signed-in user and expires; it is signed,
 * not encrypted, and holds no secret.
 */
export function createConfirmationCodec(
  key: string | Uint8Array,
): ConfirmationCodec {
  return createRequestStateCodec<Pending>({
    key,
    ttlSeconds: CONFIRMATION_TTL_SECONDS,
    bind: (ctx) => {
      const userId = ctx.http?.authInfo?.extra?.userId;
      return typeof userId === "string" ? userId : "";
    },
  });
}

/** Whether the client can show a form elicitation for this request. */
function canAskUser(ctx: ServerContext, server: McpServer): boolean {
  // 2026-07-28 requests declare capabilities per request; a 2025 stdio
  // connection declared them at initialize. Stateless 2025 HTTP has neither.
  const capabilities = ctx.mcpReq.envelope
    ? ((ctx.mcpReq.envelope as Record<string, unknown>)[
        CLIENT_CAPABILITIES_KEY
      ] as ClientCapabilities | undefined)
    : server.server.getClientCapabilities();
  const elicitation = capabilities?.elicitation;
  return (
    elicitation !== undefined &&
    (elicitation.form !== undefined || Object.keys(elicitation).length === 0)
  );
}

/**
 * Wraps a tool handler so the user confirms the action first, through a
 * multi round-trip request. Nothing is kept between the two requests: the
 * pending operation travels in the signed requestState.
 *
 * Clients that cannot be asked follow the configured mode: `when-supported`
 * runs the action, `required` refuses it.
 */
export function withConfirmation<
  Args,
  Handler extends (args: Args, ctx: ServerContext) => Promise<CallToolResult>,
>(
  handler: Handler,
  confirmation: Confirmation<Args>,
  { server, codec, mode }: ConfirmationSettings,
): Handler {
  const confirmed = async (args: Args, ctx: ServerContext) => {
    if (mode === "off") return handler(args, ctx);

    const operation = confirmation.operation(args);
    const pending = ctx.mcpReq.requestState<Pending>();
    if (pending !== undefined) {
      if (pending.operation !== operation) {
        throw new Error("This confirmation was given for a different action.");
      }
      if (
        acceptedContent(ctx.mcpReq.inputResponses, CONFIRM_KEY, confirmSchema) ===
        undefined
      ) {
        throw new Error("Not done: the user did not confirm.");
      }
      return handler(args, ctx);
    }

    if (!codec) {
      if (mode === "required") {
        throw new Error(
          `Confirmation is required, but ${ENV_STATE_SECRET} is not set.`,
        );
      }
      return handler(args, ctx);
    }
    if (!canAskUser(ctx, server)) {
      if (mode === "required") {
        throw new Error(
          "Confirmation is required, but this client cannot ask the user.",
        );
      }
      return handler(args, ctx);
    }

    return inputRequired({
      inputRequests: {
        [CONFIRM_KEY]: inputRequired.elicit({
          message: await confirmation.message(args, ctx),
          requestedSchema: {
            type: "object",
            properties: {
              confirm: { type: "boolean", title: "Yes, do it" },
            },
            required: ["confirm"],
          },
        }),
      },
      requestState: await codec.mint({ operation }, ctx),
    });
  };
  // Typed as the wrapped handler so registerTool keeps inferring the tool's
  // arguments; the SDK accepts the input-required result as well.
  return confirmed as unknown as Handler;
}
