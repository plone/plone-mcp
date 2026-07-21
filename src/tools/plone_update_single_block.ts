import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError, processBlock } from "../utils/block-utils.js";
import { PloneContent } from "../plone-client.js";

const inputSchema = z.object({
  path: z.string().describe("Path to the content"),
  blockId: z.string().describe("ID of the block to update"),
  blockData: z.record(z.string(), z.unknown()).describe("New block data"),
});

export const ploneUpdateSingleBlock = {
  config: {
    name: "plone_update_single_block",
    description:
      "Modifies the data of a single, existing block within a content item, identified by its block ID. Example: plone_update_single_block({path: '/my-page', blockId: 'abc123', blockData: {text: 'Updated text'}})",
    inputSchema,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    const sessionId = extra.sessionId || "default";
    const service = sessionManager.getSession(sessionId);

    try {
      const { path, blockId, blockData } = args;
      const client = service.getClient();

      // First get the current content
      const content = (await client.get(path)) as PloneContent;

      const blocks = content.blocks || {};

      if (!blocks[blockId]) {
        const availableBlockIds = Object.keys(blocks);
        throw new Error(
          `Block with ID '${blockId}' not found. Available block IDs: ${availableBlockIds.join(
            ", ",
          )}`,
        );
      }

      // Update the specific block
      const existingBlock = blocks[blockId] as Record<string, unknown>;
      const blockType =
        (blockData["@type"] as string) || (existingBlock["@type"] as string);
      const mergedData = { ...existingBlock, ...blockData };

      blocks[blockId] = processBlock(
        blockType,
        mergedData,
        client.config.baseUrl,
      );

      // Update the content
      const updatedContent = (await client.patch(path, {
        blocks,
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
      throw wrapError("UpdateBlock", error);
    }
  },
};
