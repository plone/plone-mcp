import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
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
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>
  ) => {
    const sessionId = extra.sessionId || "default";
    const service = sessionManager.getSession(sessionId);
    const client = service.getClient();

    if (!client) {
      throw wrapError("plone-site", "Plone client not configured.");
    }

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
