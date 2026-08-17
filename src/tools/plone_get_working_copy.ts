import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  path: z
    .string()
    .describe("Path to the content item, either the original or its working copy"),
});

export const ploneGetWorkingCopy = {
  config: {
    name: "plone_get_working_copy",
    description:
      "Shows the working copy relationship for a content item: the 'working_copy' field points to the checked out copy of an original, the 'working_copy_of' field points to the original of a working copy, and 'lock' reports whether the item is locked. Take paths from the '@id' of those fields. Example: plone_get_working_copy({path: '/my-document'})",
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

      // The @workingcopy endpoint does not report lock state, but a checkout
      // locks the original, so fetch @lock alongside it.
      const [workingCopy, lock] = await Promise.all([
        client.get(`${path}/@workingcopy`),
        client.get(`${path}/@lock`),
      ]);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { ...(workingCopy as Record<string, unknown>), lock },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      throw wrapError("GetWorkingCopy", error);
    }
  },
};
