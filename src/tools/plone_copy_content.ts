import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  parentPath: z
    .string()
    .describe(
      "Path of the destination container to copy into (e.g., '/folder' or '/' for the site root)",
    ),
  source: z
    .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
    .describe(
      "Source object(s) to copy, each specified by URL, path, or UID. Pass a single string or an array for multiple objects",
    ),
});

export const ploneCopyContent = {
  config: {
    name: "plone_copy_content",
    description:
      "Copies one or more content items into a destination container, leaving the originals in place. Sources may be given by URL, path, or UID; pass a single string or an array. Copies are auto-named 'copy_of_<id>', so the response maps each source to its new target URL. Requires the AddPortalContent permission on the destination. Example: plone_copy_content({parentPath: '/folder', source: '/front-page'})",
    inputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
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
      const result = await client.post(`${parentPath}/@copy`, { source });

      const content: { type: "text"; text: string }[] = [
        { type: "text", text: JSON.stringify(result, null, 2) },
      ];

      // The endpoint silently skips sources it cannot resolve, so a shorter
      // result list means some sources were dropped.
      const copied = Array.isArray(result) ? result.length : sources.length;
      if (copied < sources.length) {
        content.push({
          type: "text",
          text: `Warning: ${sources.length - copied} of ${sources.length} source(s) could not be resolved and were skipped. Verify each source is a valid URL, path, or UID.`,
        });
      }

      return { content };
    } catch (error) {
      throw wrapError("CopyContent", error);
    }
  },
};
