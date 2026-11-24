import { z } from "zod";
import { ServerContext } from "@modelcontextprotocol/server";
import { getClient } from "../connection.js";
import { wrapError } from "../utils/block-utils.js";
import { toolResult } from "../utils/tool-result.js";

const inputSchema = z.object({
  path: z
    .string()
    .describe(
      "Path to the working copy or to the original content item it was checked out from",
    ),
});

const outputSchema = z.object({ path: z.string(), cancelled: z.boolean() });

export const ploneCancelWorkingCopy = {
  confirmation: {
    operation: ({ path }: z.infer<typeof inputSchema>) =>
      `plone_cancel_working_copy\0${path}`,
    message: async (
      { path }: z.infer<typeof inputSchema>,
      ctx: ServerContext,
    ) => {
      const content = (await getClient(ctx).get(path)) as { title?: string };
      return `Discard the working copy of "${content.title ?? path}" (${path})? All changes made in it are lost.`;
    },
  },
  config: {
    name: "plone_cancel_working_copy",
    description:
      "Cancels a checkout, discarding the working copy and its edits. The original content is left unchanged and unlocked. Example: plone_cancel_working_copy({path: '/working_copy_of_my-document'})",
    inputSchema,
    outputSchema,
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

      return toolResult(
        { path, cancelled: true },
        `Successfully cancelled the working copy for '${path}'. The working copy has been discarded and the original unlocked.`,
      );
    } catch (error) {
      throw wrapError("CancelWorkingCopy", error);
    }
  },
};
