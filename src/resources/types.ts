import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";

export const ploneTypesResource = {
  config: {
    uri: "plone://types",
    name: "plone-types",
    description:
      "Provides direct read-only access to the list of available content types.",
    mimeType: "application/json",
  },
  handler: async (
    uri: URL,
    ctx: ServerContext
  ) => {
    const client = getClient(ctx);

    try {
      const types = await client.get("/@types");

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(types, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      throw wrapError("plone-types", `Failed to fetch types: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
