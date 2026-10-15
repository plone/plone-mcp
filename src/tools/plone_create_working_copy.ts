import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  path: z.string().describe("Path to the content item to check out"),
});

export const ploneCreateWorkingCopy = {
  config: {
    name: "plone_create_working_copy",
    description:
      "Checks out a content item, creating a working copy that can be edited without touching the published original. The original is locked until the working copy is checked in or cancelled. The copy is created next to the original as 'working_copy_of_<id>', so use the '@id' from the response instead of building that path yourself. Example: plone_create_working_copy({path: '/my-document'})",
    inputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
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
