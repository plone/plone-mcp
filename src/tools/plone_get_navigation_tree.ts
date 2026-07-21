import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  root_path: z
    .string()
    .optional()
    .describe("Starting point for navigation tree (defaults to portal root)"),
  depth: z
    .number()
    .optional()
    .default(2)
    .describe("How deep to traverse in the navigation tree"),
});

export const ploneGetNavigationTree = {
  config: {
    name: "plone_get_navigation_tree",
    description:
      "Get hierarchical navigation tree from any point in the site. Essential for understanding content organization and relationships. Example: plone_get_navigation_tree({root_path: '/documentation', depth: 3})",
    inputSchema,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    try {
      const { root_path, depth } = args;
      const sessionId = extra.sessionId || "default";
      const service = sessionManager.getSession(sessionId);
      const client = service.getClient();

      const normalizedRootPath =
        typeof root_path === "string" ? client.normalizePath(root_path) : "";

      const navigationPath = normalizedRootPath
        ? `${normalizedRootPath}/@navigation`
        : "/@navigation";

      // Build query parameters for navigation
      const params: Record<string, unknown> = {
        depth: typeof depth === "number" ? depth : 2,
      };

      // Use the @navigation endpoint
      const navigation = await client.get(navigationPath, params);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(navigation, null, 2),
          },
        ],
      };
    } catch (error) {
      throw wrapError("GetNavigationTree", error);
    }
  },
};
