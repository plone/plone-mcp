import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

export const ploneContentResource = {
  config: {
    uriTemplate: new ResourceTemplate("plone://content{+path}", {
      list: undefined,
    }),
    name: "plone-content",
    description:
      "Provides direct read-only access to the full JSON of a Plone content item via its path.",
    mimeType: "application/json",
  },
  handler: async (
    uri: URL,
    variables: Variables,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>
  ) => {
    const sessionId = extra.sessionId || "default";
    const service = sessionManager.getSession(sessionId);
    const client = service.getClient();

    const path = (variables.path as string) || "";
    const normalizedPath = client.normalizePath(path);

    try {
      const content = await client.get(normalizedPath);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(content, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      throw wrapError("plone-content", `Failed to fetch content at "${normalizedPath}": ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
