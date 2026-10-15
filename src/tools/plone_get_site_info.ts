import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({});

export const ploneGetSiteInfo = {
  config: {
    name: "plone_get_site_info",
    description:
      "Retrieves top-level information and metadata about the connected Plone site, such as available languages and Plone version.",
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
      const siteInfo = await client.get("/");

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(siteInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      throw wrapError("GetSiteInfo", error);
    }
  },
};
