import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";
import { toolResult } from "../utils/tool-result.js";

const inputSchema = z.object({
  path: z
    .string()
    .describe("Path to the content item to unlink a translation from"),
  language: z
    .string()
    .describe("Language code of the translation to unlink (e.g., 'de', 'fr')"),
});

const outputSchema = z.object({
  path: z.string(),
  language: z.string(),
  unlinked: z.boolean(),
});

export const ploneUnlinkTranslation = {
  config: {
    name: "plone_unlink_translation",
    description:
      "Removes the translation link between a content item and one of its translations, identified by language code. Example: plone_unlink_translation({path: '/en/my-page', language: 'de'})",
    inputSchema,
    outputSchema,
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
      const client = getClient(ctx);

      await client.delete(`${path}/@translations`, { language });

      return toolResult(
        { path, language, unlinked: true },
        `Successfully unlinked '${language}' translation from '${path}'.`,
      );
    } catch (error) {
      throw wrapError("UnlinkTranslation", error);
    }
  },
};
