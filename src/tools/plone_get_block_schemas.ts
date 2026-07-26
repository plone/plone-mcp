import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { blockRegistry } from "../block-registry.js";
import { wrapError, getBlockExample } from "../utils/block-utils.js";

const inputSchema = z.object({
  blockType: z
    .enum(blockRegistry.getBlockTypesEnum())
    .optional()
    .describe(
      "Specific block type to get schema for (optional, returns all if not specified).",
    ),
});

export const ploneGetBlockSchemas = {
  config: {
    name: "plone_get_block_schemas",
    description:
      "Lists all available Volto block types (e.g., 'slate', 'teaser', 'button') and their required data schemas. **Essential for understanding how to construct blocks.** Example: plone_get_block_schemas({blockType: 'teaser'})",
    inputSchema,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    try {
      const { blockType } = args;

      if (blockType && blockType !== "") {
        const spec = blockRegistry.getSpecification(blockType);
        if (!spec) {
          throw new Error(
            `Unknown block type: ${blockType}. Available types: ${blockRegistry
              .getBlockTypes()
              .join(", ")} `,
          );
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  blockType: blockType,
                  specification: spec,
                  example: getBlockExample(blockType),
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Return all block schemas with examples
      const examples: Record<string, unknown> = {};
      for (const type of blockRegistry.getBlockTypes()) {
        examples[type] = getBlockExample(type);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                availableTypes: blockRegistry.getBlockTypes(),
                specifications: blockRegistry.getSpecifications(),
                examples: examples,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      throw wrapError("GetBlockSchemas", error);
    }
  },
};
