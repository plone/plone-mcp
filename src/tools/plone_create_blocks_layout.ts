import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { blockRegistry } from "../block-registry.js";
import {
  wrapError,
  generateBlockId,
  processBlock,
  validateImageURL,
} from "../utils/block-utils.js";
import { PreparedBlocks } from "../plone-service.js";

const inputSchema = z.object({
  blocks: z
    .array(
      z.object({
        type: z
          .enum(blockRegistry.getBlockTypesEnum())
          .describe("Type of block to create"),
        data: z
          .record(z.string(), z.unknown())
          .describe("Block-specific data following the block specification"),
        position: z
          .number()
          .optional()
          .describe(
            "Position in the layout (optional, defaults to sequential order)",
          ),
      }),
    )
    .describe(
      "Array of block specifications to process. You MUST call plone_get_block_schemas first to see available block types and their required fields. You MUST follow the block specifications EXACTLY, DO NOT invent your own fields. DO NOT add the content object's title in a text block. To set the page title, use the 'title' field of the content object itself when calling plone_create_content or plone_update_content. A Title block will be automatically created by Plone.",
    ),
});

export const ploneCreateBlocksLayout = {
  config: {
    name: "plone_create_blocks_layout",
    description:
      "Prepares a complete block structure in memory (valid for 60 seconds). This structure is then used by the **next immediate call** to `plone_create_content` or `plone_update_content`. Use `plone_get_block_schemas` to learn what data each block type needs. The text displayed by the Title block is automatically managed by Plone, DO NOT add it in the block's data. Example: plone_create_blocks_layout({blocks: [{type: 'title'},{type: 'slate', data: {text: 'Hello World'}}]})",
    inputSchema,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    const sessionId = extra.sessionId || "default";
    const service = sessionManager.getSession(sessionId);

    try {
      const { blocks } = args;
      const processedBlocks: Record<string, unknown> = {};
      const blockIds: string[] = [];
      const blockInfo: { id: string; type: string }[] = [];

      // Process each block in the array
      for (const blockSpec of blocks) {
        // Validate image URLs asynchronously before processing
        if (
          blockSpec.type === "image" &&
          typeof blockSpec.data.url === "string" &&
          blockSpec.data.url
        ) {
          const isValid = await validateImageURL(blockSpec.data.url);
          if (!isValid) {
            throw wrapError(
              "CreateBlocksLayout",
              `Invalid or inaccessible image URL: ${blockSpec.data.url} `,
            );
          }
        }

        const blockId = generateBlockId();
        const baseUrl = service.client?.config.baseUrl;
        const processedBlock = processBlock(
          blockSpec.type,
          blockSpec.data,
          baseUrl,
        );

        processedBlocks[blockId] = processedBlock;
        blockIds.push(blockId);
        blockInfo.push({ id: blockId, type: blockSpec.type });
      }

      // Store the prepared blocks for immediate use with timestamp
      const preparedBlocksData: PreparedBlocks = {
        blocks: processedBlocks,
        blocks_layout: { items: blockIds },
        timestamp: Date.now(),
      };
      service.setPreparedBlocks(preparedBlocksData);

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully prepared ${
              blocks.length
            } blocks for next create / update operation(valid for 60 seconds).Blocks ready: ${blockInfo
              .map((block) => `${block.type}:[${block.id}]`)
              .join(", ")} `,
          },
        ],
      };
    } catch (error) {
      // Clear prepared blocks on error
      service.clearPreparedBlocks();
      throw wrapError("CreateBlocksLayout", error);
    }
  },
};
