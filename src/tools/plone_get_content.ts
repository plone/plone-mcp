import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  path: z
    .string()
    .describe(
      "Path to content (e.g., '/parentDocument/document' or just '/' for root level)",
    ),
  expand: z
    .array(z.string())
    .optional()
    .describe(
      "Components to expand (e.g., ['breadcrumbs', 'actions', 'workflow'])",
    ),
});

export const ploneGetContent = {
  config: {
    name: "plone_get_content",
    description:
      "Retrieves the full JSON data for a single content item from Plone using its path. Example: plone_get_content({path: '/news/latest-update'})",
    inputSchema,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    try {
      const { path, expand } = args;
      const sessionId = extra.sessionId || "default";
      const service = sessionManager.getSession(sessionId);
      const client = service.getClient();

      const params: Record<string, unknown> = {};
      if (expand && expand.length > 0) {
        params.expand = expand.join(",");
      }

      const content = await client.get(path, params);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(content, null, 2),
          },
        ],
      };
    } catch (error) {
      throw wrapError("GetContent", error);
    }
  },
};
