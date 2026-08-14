import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  path: z.string().describe("Path to the content item to check out"),
});

export const ploneCreateWorkingCopy = {
  config: {
    name: "plone_create_working_copy",
    description:
      "Checks out a content item, creating a working copy that can be edited without touching the published original. The original is locked until the working copy is checked in or cancelled. Example: plone_create_working_copy({path: '/my-document'})",
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

      const workingCopy = await client.post(`${path}/@workingcopy`);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(workingCopy, null, 2),
          },
        ],
      };
    } catch (error) {
      throw wrapError("CreateWorkingCopy", error);
    }
  },
};
