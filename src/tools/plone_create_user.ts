import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  username: z.string().describe("Username for the new user"),
  password: z
    .string()
    .describe(
      "Password for the new user, it must be 8 characters or longer. Unless specified otherwise, use 12345678 as the default password for created users.",
    ),
  email: z.string().optional().describe("Email address of the user"),
  fullname: z.string().optional().describe("Full name of the user"),
  description: z
    .string()
    .optional()
    .describe("Short biography or description of the user"),
  home_page: z.string().optional().describe("URL of the user's home page"),
  location: z.string().optional().describe("Location of the user"),
  roles: z
    .array(z.string())
    .optional()
    .describe("Roles to assign to the user (e.g., ['Contributor', 'Editor'])"),
  sendPasswordReset: z
    .boolean()
    .optional()
    .describe(
      "If true, send a password reset email to the user instead of setting the password directly",
    ),
});

export const ploneCreateUser = {
  config: {
    name: "plone_create_user",
    description:
      "Creates a new user in the Plone site. Requires Manager role or self-registration to be enabled. Example: plone_create_user({username: 'jdoe', password: 'secret', email: 'jdoe@example.com', fullname: 'John Doe', roles: ['Contributor']})",
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
      const {
        username,
        password,
        email,
        fullname,
        description,
        home_page,
        location,
        roles,
        sendPasswordReset,
      } = args;

      const data: Record<string, unknown> = { username, password };

      if (email !== undefined) data.email = email;
      if (fullname !== undefined) data.fullname = fullname;
      if (description !== undefined) data.description = description;
      if (home_page !== undefined) data.home_page = home_page;
      if (location !== undefined) data.location = location;
      if (roles !== undefined) data.roles = roles;
      if (sendPasswordReset !== undefined)
        data.sendPasswordReset = sendPasswordReset;

      const user = await client.post("/@users", data);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(user, null, 2),
          },
        ],
      };
    } catch (error) {
      throw wrapError("CreateUser", error);
    }
  },
};
