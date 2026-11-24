import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";
import { toolResult } from "../utils/tool-result.js";

const inputSchema = z.object({});

export const ploneGetTypes = {
  config: {
    name: "plone_get_types",
    description:
      "Lists all available content types that can be created in the Plone site (e.g., 'Document', 'Event').",
    inputSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
  },
  handler: async (
    _args: z.infer<typeof inputSchema>,
    ctx: ServerContext,
  ) => {
    try {
      const client = getClient(ctx);
      const types = await client.get("/@types");

      return toolResult(types);
    } catch (error) {
      throw wrapError("GetTypes", error);
    }
  },
};
