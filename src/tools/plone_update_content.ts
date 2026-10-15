import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";
import {
  blockSpecsSchema,
  buildBlocksFromSpecs,
  processBlocksForContent,
} from "../utils/content-blocks.js";

const inputSchema = z.object({
  path: z.string().describe("Path to the content to update"),
  title: z.string().optional().describe("New title"),
  description: z.string().optional().describe("New description"),
  blocks: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Volto blocks structure for the content. Prefer block_specs."),
  blocks_layout: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Volto blocks layout configuration"),
  block_specs: blockSpecsSchema.optional(),
  additionalFields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Additional fields to update. For preview images, include preview_image_link: { '@id': 'image-url' } in this object (if you get a 400 error, make sure the image URL is accessible).",
    ),
});

export const ploneUpdateContent = {
  config: {
    name: "plone_update_content",
    description:
      "Modifies an existing content item in Plone. Can update metadata (like title) and/or replace the entire block structure. To replace the blocks, pass `block_specs` (see `plone_get_block_schemas`); they are converted and saved in this same call. Example: plone_update_content({path: '/my-page', title: 'Updated Title'})",
    inputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
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
        path,
        title,
        description,
        blocks,
        blocks_layout,
        block_specs,
        additionalFields,
      } = args;

      if (!path) {
        throw new Error("Path is required for updating content");
      }
      if (block_specs && (blocks || blocks_layout)) {
        throw new Error(
          "Pass either block_specs or blocks/blocks_layout, not both.",
        );
      }

      const data: Record<string, unknown> = {};
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;

      const built = block_specs
        ? await buildBlocksFromSpecs(block_specs, client.baseUrl)
        : undefined;
      const blockData = processBlocksForContent({
        blocks,
        blocks_layout,
        built,
        isUpdate: true,
        baseUrl: client.baseUrl,
      });
      if (blockData) {
        data.blocks = blockData.blocks;
        data.blocks_layout = blockData.blocks_layout;
      }

      if (additionalFields) Object.assign(data, additionalFields);

      if (Object.keys(data).length === 0) {
        throw new Error("No changes specified for update");
      }

      const content = await client.patch(path, data);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(content, null, 2),
          },
        ],
      };
    } catch (error) {
      throw wrapError("UpdateContent", error);
    }
  },
};
