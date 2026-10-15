import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
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
      "Checks in a working copy, replacing the original content with the edits made on the copy. The working copy is deleted and the original is unlocked. Example: plone_checkin_working_copy({path: '/working_copy_of_my-document'})",
    inputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
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
