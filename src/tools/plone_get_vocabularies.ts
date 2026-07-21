import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  vocabulary: z.string().describe("Vocabulary name"),
  title: z.string().optional().describe("Filter by title"),
  token: z.string().optional().describe("Filter by token"),
});

export const ploneGetVocabularies = {
  config: {
    name: "plone_get_vocabularies",
    description:
      "Fetches the allowed values for a specific field, such as a list of categories or tags. Useful for finding valid inputs for content fields. Example: plone_get_vocabularies({vocabulary: 'plone.app.vocabularies.Keywords'})",
    inputSchema,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    try {
      const sessionId = extra.sessionId || "default";
      const service = sessionManager.getSession(sessionId);
      const client = service.getClient();
      const { vocabulary, title, token } = args;

      const params: Record<string, unknown> = {};
      if (title) params.title = title;
      if (token) params.token = token;

      const vocabularies = await client.get(
        `/@vocabularies/${vocabulary}`,
        params,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(vocabularies, null, 2),
          },
        ],
      };
    } catch (error) {
      throw wrapError("GetVocabularies", error);
    }
  },
};
