import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";
import { PloneContent } from "../plone-client.js";

const inputSchema = z.object({
  parentPath: z
    .string()
    .describe(
      "Path where to create the content (e.g., '/parentDocument/document' or '/' for root)",
    ),
  type: z
    .string()
    .describe(
      "Content type to create (e.g., 'Document', 'Event', 'News Item')",
    ),
  title: z.string().describe("Title of the new content"),
  description: z.string().optional().describe("Description of the new content"),
  id: z
    .string()
    .optional()
    .describe(
      "ID for the new content (optional, will be auto-generated if not provided)",
    ),
  blocks: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Volto blocks structure for the content, it specifies the blocks data and content",
    ),
  blocks_layout: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Volto blocks layout configuration, it specifies the order of blocks",
    ),
  additionalFields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Additional fields to update. For preview images, include preview_image_link: { '@id': 'image-url' } in this object (if you get a 400 error, make sure the image URL is accessible).",
    ),
});

export const ploneCreateContent = {
  config: {
    name: "plone_create_content",
    description:
      "Creates a new content item (e.g., a page or news article) in Plone. To add complex block-based content, first prepare the structure with `plone_create_blocks_layout`, then call this tool. Example: plone_create_content({parentPath: '/', type: 'Document', title: 'My Page', description: 'A sample page'})",
    inputSchema,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    const sessionId = extra.sessionId || "default";
    const service = sessionManager.getSession(sessionId);

    try {
      const client = service.getClient();
      const {
        parentPath,
        type,
        title,
        description,
        id,
        blocks,
        blocks_layout,
        additionalFields,
      } = args;

      const data: Record<string, unknown> = {
        "@type": type,
        title,
      };

      if (description) data.description = description;
      if (id) data.id = id;

      // Use the centralized helper to process blocks
      const blockData = service.processBlocksForContent(
        blocks,
        blocks_layout,
        false,
      );
      if (blockData) {
        data.blocks = blockData.blocks;
        data.blocks_layout = blockData.blocks_layout;
      }

      if (additionalFields) Object.assign(data, additionalFields);

      const content: PloneContent = (await client.post(
        parentPath,
        data,
      )) as PloneContent;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(content, null, 2),
          },
        ],
      };
    } catch (error) {
      // Ensure prepared blocks are cleared on any error
      service.clearPreparedBlocks();
      throw wrapError("CreateContent", error);
    }
  },
};
