import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  path: z.string().describe("Path to the content to update"),
  title: z.string().optional().describe("New title"),
  description: z.string().optional().describe("New description"),
  blocks: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Volto blocks structure for the content"),
  blocks_layout: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Volto blocks layout configuration"),
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
      "Modifies an existing content item in Plone. Can update metadata (like title) and/or replace the entire block structure. Use `plone_create_blocks_layout` to prepare complex block updates. Example: plone_update_content({path: '/my-page', title: 'Updated Title'})",
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
        path,
        title,
        description,
        blocks,
        blocks_layout,
        additionalFields,
      } = args;

      if (!path) {
        throw new Error("Path is required for updating content");
      }

      const data: Record<string, unknown> = {};
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;

      // Use the centralized helper, which will return null if no block changes are needed
      const blockData = service.processBlocksForContent(
        blocks,
        blocks_layout,
        true,
      );
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
      service.clearPreparedBlocks();
      throw wrapError("UpdateContent", error);
    }
  },
};
