import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";
import {
  blockSpecsSchema,
  buildBlocksFromSpecs,
} from "../utils/content-blocks.js";

const inputSchema = z.object({
  block_specs: blockSpecsSchema,
});

export const ploneValidateBlocks = {
  config: {
    name: "plone_validate_blocks",
    description:
      "Checks block specifications without saving anything, and reports the first invalid spec by index. Optional: `plone_create_content` and `plone_update_content` run the same checks on their `block_specs`. Example: plone_validate_blocks({block_specs: [{type: 'slate', data: {text: 'Hello World'}}]})",
    inputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    ctx: ServerContext,
  ) => {
    try {
      const { block_specs } = args;
      const { baseUrl } = getClient(ctx);

      await buildBlocksFromSpecs(block_specs, baseUrl);

      return {
        content: [
          {
            type: "text" as const,
            text: `All ${block_specs.length} block specs are valid.`,
          },
        ],
      };
    } catch (error) {
      throw wrapError("ValidateBlocks", error);
    }
  },
};
