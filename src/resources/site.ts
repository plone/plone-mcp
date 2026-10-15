import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";

export const ploneSiteResource = {
  config: {
    uri: "plone://site",
    name: "plone-site",
    description:
      "Provides direct read-only access to the Plone site's root information object.",
    mimeType: "application/json",
  },
  handler: async (
    uri: URL,
    ctx: ServerContext
  ) => {
    const client = getClient(ctx);

    try {
      const siteInfo = await client.get("/");

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(siteInfo, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      throw wrapError("plone-site", `Failed to fetch site info: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
