import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";
import { PloneContent } from "../plone-client.js";

const inputSchema = z.object({
  path: z.string().describe("Path to the content"),
  blockId: z.string().describe("ID of the block to remove"),
});

export const ploneRemoveSingleBlock = {
  config: {
    name: "plone_remove_single_block",
    description:
      "Deletes a single block from a content item, identified by its block ID. Example: plone_remove_single_block({path: '/my-page', blockId: 'abc123'})",
    inputSchema,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    const sessionId = extra.sessionId || "default";
    const service = sessionManager.getSession(sessionId);

    try {
      const { path, blockId } = args;
      const client = service.getClient();

      // First get the current content
      const content = (await client.get(path)) as PloneContent;

      const blocks = content.blocks || {};
      const blocks_layout = content.blocks_layout || { items: [] };

      if (!blocks[blockId]) {
        const availableBlockIds = Object.keys(blocks);
        throw new Error(
          `Block with ID '${blockId}' not found. Available block IDs: ${availableBlockIds.join(
            ", ",
          )}`,
        );
      }

      // Remove the block
      const updatedBlocks = Object.fromEntries(
        Object.entries(blocks).filter(([key]) => key !== blockId),
      );

      // Remove from layout
      const updatedLayoutItems = blocks_layout.items.filter(
        (id: string) => id !== blockId,
      );

      // Update the content
      const updatedContent = (await client.patch(path, {
        blocks: updatedBlocks,
        blocks_layout: { items: updatedLayoutItems },
      })) as PloneContent;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(updatedContent, null, 2),
          },
        ],
      };
    } catch (error) {
      throw wrapError("RemoveBlock", error);
    }
  },
};
