import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  path: z.string().describe("Path to the content to delete"),
});

export const ploneDeleteContent = {
  config: {
    name: "plone_delete_content",
    description:
      "Permanently deletes a content item from Plone using its path. Example: plone_delete_content({path: '/old-content'})",
    inputSchema,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    try {
      const { path } = args;
      const sessionId = extra.sessionId || "default";
      const service = sessionManager.getSession(sessionId);
      const client = service.getClient();

      await client.delete(path);

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully deleted content at path: ${path} `,
          },
        ],
      };
    } catch (error) {
      throw wrapError("DeleteContent", error);
    }
  },
};
