import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  path: z.string().describe("Path to the content to delete"),
});

export const ploneDeleteContent = {
  config: {
    name: "plone_delete_content",
    description:
      "Permanently deletes a content item from Plone using its path. Example: plone_delete_content({path: '/old-content'})",
    inputSchema,
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

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully deleted content at path: ${path} `,
          },
        ],
      };
    } catch (error) {
      throw wrapError("DeleteContent", error);
    }
  },
};
