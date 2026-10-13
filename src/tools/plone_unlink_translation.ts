import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  path: z
    .string()
    .describe("Path to the content item to unlink a translation from"),
  language: z
    .string()
    .describe("Language code of the translation to unlink (e.g., 'de', 'fr')"),
});

export const ploneUnlinkTranslation = {
  config: {
    name: "plone_unlink_translation",
    description:
      "Removes the translation link between a content item and one of its translations, identified by language code. Example: plone_unlink_translation({path: '/en/my-page', language: 'de'})",
    inputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    ctx: ServerContext,
  ) => {
    try {
      const { path, language } = args;
      const sessionId = ctx.sessionId || "default";
      const service = sessionManager.getSession(sessionId);
      const client = service.getClient();

      await client.delete(`${path}/@translations`, { language });

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully unlinked '${language}' translation from '${path}'.`,
          },
        ],
      };
    } catch (error) {
      throw wrapError("UnlinkTranslation", error);
    }
  },
};
