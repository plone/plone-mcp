import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  userid: z.string().describe("The ID of the user to update"),
  email: z.string().optional().describe("New email address"),
  fullname: z.string().optional().describe("New full name"),
  description: z.string().optional().describe("New biography or description"),
  home_page: z.string().optional().describe("New home page URL"),
  location: z.string().optional().describe("New location"),
  roles: z
    .record(z.string(), z.boolean())
    .optional()
    .describe(
      "Roles to add or remove, as an object mapping role names to booleans (e.g., {Contributor: true, Editor: false})",
    ),
});

export const ploneUpdateUser = {
  config: {
    name: "plone_update_user",
    description:
      "Updates an existing user's properties in Plone. Requires Manager role or the user updating their own account. Roles are specified as an object mapping role names to booleans to add or remove them. Example: plone_update_user({userid: 'jdoe', fullname: 'Jane Doe', roles: {Editor: true, Contributor: false}})",
    inputSchema,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    const sessionId = extra.sessionId || "default";
    const service = sessionManager.getSession(sessionId);

    try {
      const client = service.getClient();
      const { userid, ...fields } = args;

      const data: Record<string, unknown> = {};

      if (fields.email !== undefined) data.email = fields.email;
      if (fields.fullname !== undefined) data.fullname = fields.fullname;
      if (fields.description !== undefined) data.description = fields.description;
      if (fields.home_page !== undefined) data.home_page = fields.home_page;
      if (fields.location !== undefined) data.location = fields.location;
      if (fields.roles !== undefined) data.roles = fields.roles;

      if (Object.keys(data).length === 0) {
        throw new Error("No changes specified for update");
      }

      await client.patch(`/@users/${userid}`, data);

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully updated user: ${userid}`,
          },
        ],
      };
    } catch (error) {
      throw wrapError("UpdateUser", error);
    }
  },
};
