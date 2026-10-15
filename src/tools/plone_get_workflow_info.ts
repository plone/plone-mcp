import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
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
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    ctx: ServerContext,
  ) => {
    try {
      const { path } = args;
      const client = getClient(ctx);

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
