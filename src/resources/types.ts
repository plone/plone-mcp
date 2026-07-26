import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
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
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>
  ) => {
    const sessionId = extra.sessionId || "default";
    const service = sessionManager.getSession(sessionId);
    const client = service.getClient();

    if (!client) {
      throw wrapError("plone-types", "Plone client not configured.");
    }

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
