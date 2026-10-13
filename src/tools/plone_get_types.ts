import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({});

export const ploneGetTypes = {
  config: {
    name: "plone_get_types",
    description:
      "Lists all available content types that can be created in the Plone site (e.g., 'Document', 'Event').",
    inputSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
  },
  handler: async (
    _args: z.infer<typeof inputSchema>,
    ctx: ServerContext,
  ) => {
    try {
      const sessionId = ctx.sessionId || "default";
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
