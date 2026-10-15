import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  contentType: z
    .string()
    .describe("Content type to get the schema for (e.g., 'Document')"),
});

export const ploneGetTypeSchema = {
  config: {
    name: "plone_get_type_schema",
    description:
      "Gets the full JSON schema for a specific content type, including all fields, their types, required status, and validation rules. Use this to understand what fields are available when creating or updating content. Example: plone_get_type_schema({contentType: 'Document'})",
    inputSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    ctx: ServerContext,
  ) => {
    try {
      const client = getClient(ctx);
      const { contentType } = args;
      const typeSchema = await client.get(`/@types/${contentType}`);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(typeSchema, null, 2),
          },
        ],
      };
    } catch (error) {
      throw wrapError("GetTypeSchema", error);
    }
  },
};
