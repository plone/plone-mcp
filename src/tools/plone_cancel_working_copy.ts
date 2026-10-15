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

export const ploneCancelWorkingCopy = {
  config: {
    name: "plone_cancel_working_copy",
    description:
      "Cancels a checkout, discarding the working copy and its edits. The original content is left unchanged and unlocked. Example: plone_cancel_working_copy({path: '/working_copy_of_my-document'})",
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

      await client.delete(`${path}/@workingcopy`);

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully cancelled the working copy for '${path}'. The working copy has been discarded and the original unlocked.`,
          },
        ],
      };
    } catch (error) {
      throw wrapError("CancelWorkingCopy", error);
    }
  },
};
