import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { sessionManager } from "../session-manager.js";
import {
  ENV_BASE_URL,
  ENV_USERNAME,
  ENV_PASSWORD,
  ENV_TOKEN,
  PloneClient,
  Config,
} from "../plone-client.js";
import { wrapError } from "../utils/block-utils.js";

const inputSchema = z.object({
  baseUrl: z
    .string()
    .optional()
    .describe(
      "Base URL of the Plone site. Can be set via PLONE_BASE_URL environment variable.",
    ),
  username: z
    .string()
    .optional()
    .describe(
      "Username for authentication. Can be set via PLONE_USERNAME environment variable.",
    ),
  password: z
    .string()
    .optional()
    .describe(
      "Password for authentication. Can be set via PLONE_PASSWORD environment variable.",
    ),
  token: z
    .string()
    .optional()
    .describe(
      "JWT token for authentication (alternative to username/password). Can be set via PLONE_TOKEN environment variable.",
    ),
});

export const ploneConfigure = {
  config: {
    name: "plone_configure",
    description:
      "Establishes and authenticates the connection to a Plone CMS. **Must be called once per session** before other tools can be used. Configuration can be provided via arguments or environment variables (PLONE_BASE_URL, PLONE_USERNAME, PLONE_PASSWORD, PLONE_TOKEN). Arguments take precedence over environment variables. To use environment variables only, call with an empty object: plone_configure({}). Example with arguments: plone_configure({baseUrl: 'https://demo.plone.org', username: 'admin', password: 'secret'}).",
    inputSchema,
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    const sessionId = extra.sessionId || "default";
    const service = sessionManager.getSession(sessionId);

    // Build config from args and environment variables
    const config: Config = {
      baseUrl: args.baseUrl || process.env[ENV_BASE_URL],
      username: args.username || process.env[ENV_USERNAME],
      password: args.password || process.env[ENV_PASSWORD],
      token: args.token || process.env[ENV_TOKEN],
    };

    try {
      const client = new PloneClient(config);
      await client.get("/");
      service.client = client;

      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully configured connection to Plone site: ${client.baseUrl}`,
          },
        ],
      };
    } catch (error) {
      service.client = null;
      throw wrapError("Configure", error);
    }
  },
};
