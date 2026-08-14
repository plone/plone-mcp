import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  path: z
    .string()
    .describe(
      "Path to the working copy or to the original content item it was checked out from",
    ),
});

export const ploneCheckinWorkingCopy = {
  config: {
    name: "plone_checkin_working_copy",
    description:
      "Checks in a working copy, replacing the original content with the edits made on the copy. The working copy is deleted and the original is unlocked. Example: plone_checkin_working_copy({path: '/copy_of_my-document'})",
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

      await client.patch(`${path}/@workingcopy`);

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully checked in working copy for '${path}'. The working copy has been deleted and the original unlocked.`,
          },
        ],
      };
    } catch (error) {
      throw wrapError("CheckinWorkingCopy", error);
    }
  },
};
