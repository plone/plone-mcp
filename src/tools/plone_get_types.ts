import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({});

export const ploneGetTypes = {
  config: {
    name: "plone_get_types",
    description:
      "Lists all available content types that can be created in the Plone site (e.g., 'Document', 'Event').",
    inputSchema,
  },
  handler: async (
    _args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    try {
      const sessionId = extra.sessionId || "default";
      const service = sessionManager.getSession(sessionId);
      const client = service.getClient();
      const types = await client.get("/@types");

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(types, null, 2),
          },
        ],
      };
    } catch (error) {
      throw wrapError("GetTypes", error);
    }
  },
};
