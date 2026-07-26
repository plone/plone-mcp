import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  vocabulary: z
    .string()
    .optional()
    .describe(
      "Vocabulary name (e.g. 'plone.app.vocabularies.Keywords'). Omit to list all available vocabularies.",
    ),
  title: z.string().optional().describe("Filter terms by title"),
  token: z.string().optional().describe("Filter terms by token"),
});

export const ploneGetVocabularies = {
  config: {
    name: "plone_get_vocabularies",
    description:
      "Lists all available vocabularies, or fetches the allowed values of one specific vocabulary — such as a list of categories or tags. Useful for finding valid inputs for content fields. Call with no arguments to discover vocabulary names, then with a name to get its terms. Example: plone_get_vocabularies({vocabulary: 'plone.app.vocabularies.Keywords'})",
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

      // Without a name, @vocabularies enumerates all available vocabularies
      const vocabularies = await client.get(
        vocabulary ? `/@vocabularies/${vocabulary}` : "/@vocabularies",
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
