import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  path: z.string().describe("Path to the content"),
});

export const ploneGetWorkflowInfo = {
  config: {
    name: "plone_get_workflow_info",
    description:
      "Shows the current workflow state (e.g., 'Published', 'Private') and available transitions for a content item. Example: plone_get_workflow_info({path: '/my-document'})",
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

      const workflow = await client.get(`${path}/@workflow`);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(workflow, null, 2),
          },
        ],
      };
    } catch (error) {
      throw wrapError("GetWorkflowInfo", error);
    }
  },
};
