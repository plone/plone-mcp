import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({});

export const ploneGetSiteInfo = {
  config: {
    name: "plone_get_site_info",
    description:
      "Retrieves top-level information and metadata about the connected Plone site, such as available languages and Plone version.",
    inputSchema,
  },
  handler: async (
    _args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    try {
      const sessionId = extra.sessionId || "default";
      const service = sessionManager.getSession(sessionId);
      const client = service.getClient();
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
