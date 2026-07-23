import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  root_path: z
    .string()
    .optional()
    .describe(
      "Path whose navigation root determines the tree (defaults to portal root). Note: the tree is rooted at the nearest navigation root of this path (e.g. the language folder on multilingual sites), not at the path itself.",
    ),
  depth: z
    .number()
    .optional()
    .default(2)
    .describe("How many levels of the navigation tree to include"),
});

export const ploneGetNavigationTree = {
  config: {
    name: "plone_get_navigation_tree",
    description:
      "Get the site navigation tree as seen from a given path. The tree is rooted at the nearest navigation root (the site root, or the language folder on multilingual sites) — use depth to include nested levels, then look up the relevant subtree in the result. Example: plone_get_navigation_tree({root_path: '/en/documentation', depth: 3})",
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

      // @navigation reads the depth from the expansion parameter, a bare
      // `depth` query param is silently ignored
      const params: Record<string, unknown> = {
        "expand.navigation.depth": typeof depth === "number" ? depth : 2,
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
