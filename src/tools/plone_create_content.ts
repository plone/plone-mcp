import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";
import {
  blockSpecsSchema,
  buildBlocksFromSpecs,
  processBlocksForContent,
} from "../utils/content-blocks.js";
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
      "Volto blocks structure for the content, it specifies the blocks data and content. Prefer block_specs.",
    ),
  block_specs: blockSpecsSchema.optional(),
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
      "Creates a new content item (e.g., a page or news article) in Plone. To add block-based content, pass `block_specs` (see `plone_get_block_schemas`); they are converted and saved in this same call. Example: plone_create_content({parentPath: '/', type: 'Document', title: 'My Page', block_specs: [{type: 'slate', data: {text: 'Hello World'}}]})",
    inputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    ctx: ServerContext,
  ) => {
    try {
      const client = getClient(ctx);
      const {
        parentPath,
        type,
        title,
        description,
        id,
        blocks,
        blocks_layout,
        block_specs,
        additionalFields,
      } = args;

      if (block_specs && (blocks || blocks_layout)) {
        throw new Error(
          "Pass either block_specs or blocks/blocks_layout, not both.",
        );
      }

      const data: Record<string, unknown> = {
        "@type": type,
        title,
      };

      if (description) data.description = description;
      if (id) data.id = id;

      const built = block_specs
        ? await buildBlocksFromSpecs(block_specs, client.baseUrl)
        : undefined;
      const blockData = processBlocksForContent({
        blocks,
        blocks_layout,
        built,
        baseUrl: client.baseUrl,
      });
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
      throw wrapError("CreateContent", error);
    }
  },
};
