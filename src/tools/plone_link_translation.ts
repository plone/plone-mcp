import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  path: z.string().describe("Path to the source content item"),
  id: z
    .string()
    .describe(
      "The path of the content item to link as a translation (e.g., '/es/test-document').",
    ),
});

export const ploneLinkTranslation = {
  config: {
    name: "plone_link_translation",
    description:
      "Links an existing content item as a translation of another. Both items must already exist. Pass the '@id' (full URL) of the existing content item. Example: plone_link_translation({path: '/en/my-page', id: 'https://example.com/de/meine-seite'})",
    inputSchema,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    try {
      const { path, id } = args;
      const sessionId = extra.sessionId || "default";
      const service = sessionManager.getSession(sessionId);
      const client = service.getClient();

      const result = await client.post(`${path}/@translations`, { id });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      throw wrapError("LinkTranslation", error);
    }
  },
};
