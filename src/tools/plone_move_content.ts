import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  parentPath: z
    .string()
    .describe(
      "Path of the destination container to move into (e.g., '/folder' or '/' for the site root)",
    ),
  source: z
    .union([z.string(), z.array(z.string())])
    .describe(
      "Source object(s) to move, each specified by URL, path, or UID. Pass a single string or an array for multiple objects",
    ),
});

export const ploneMoveContent = {
  config: {
    name: "plone_move_content",
    description:
      "Moves one or more content items into a destination container, removing them from their current location. Sources may be given by URL, path, or UID; pass a single string or an array. Requires the DeleteObjects permission on the source's parent and AddPortalContent on the destination. Example: plone_move_content({parentPath: '/folder', source: '/front-page'})",
    inputSchema,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    try {
      const { parentPath, source } = args;
      const sessionId = extra.sessionId || "default";
      const service = sessionManager.getSession(sessionId);
      const client = service.getClient();

      const sources = Array.isArray(source) ? source : [source];
      const result = await client.post(`${parentPath}/@move`, { source });

      const content: { type: "text"; text: string }[] = [
        { type: "text", text: JSON.stringify(result, null, 2) },
      ];

      // The endpoint silently skips sources it cannot resolve, so a shorter
      // result list means some sources were dropped.
      const moved = Array.isArray(result) ? result.length : sources.length;
      if (moved < sources.length) {
        content.push({
          type: "text",
          text: `Warning: ${sources.length - moved} of ${sources.length} source(s) could not be resolved and were skipped. Verify each source is a valid URL, path, or UID.`,
        });
      }

      return { content };
    } catch (error) {
      throw wrapError("MoveContent", error);
    }
  },
};
