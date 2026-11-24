import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";
import { toolResult } from "../utils/tool-result.js";

const inputSchema = z.object({
  path: z.string().describe("Path to the content to delete"),
});

const outputSchema = z.object({ path: z.string(), deleted: z.boolean() });

export const ploneDeleteContent = {
  config: {
    name: "plone_delete_content",
    description:
      "Permanently deletes a content item from Plone using its path. Example: plone_delete_content({path: '/old-content'})",
    inputSchema,
    outputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    ctx: ServerContext,
  ) => {
    try {
      const { path } = args;
      const client = getClient(ctx);

      await client.delete(path);

      return toolResult(
        { path, deleted: true },
        `Successfully deleted content at path: ${path} `,
      );
    } catch (error) {
      throw wrapError("DeleteContent", error);
    }
  },
};
