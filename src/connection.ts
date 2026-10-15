import { PloneClient } from "./plone-client.js";
import type { ServerContext } from "@modelcontextprotocol/server";

export const ENV_ALLOW_ENV_CREDENTIALS_OVER_HTTP =
  "PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP";

/**
 * Builds a Plone client for the current request, without keeping any state.
 *
 * - HTTP with a verified access token: PLONE_BASE_URL plus that token.
 * - stdio: credentials from the environment.
 * - HTTP without a token: environment credentials, only when
 *   PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP is "true".
 */
export function getClient(ctx: ServerContext): PloneClient {
  const token = ctx.http?.authInfo?.token;
  if (token) {
    return new PloneClient({ token });
  }

  if (ctx.http && process.env[ENV_ALLOW_ENV_CREDENTIALS_OVER_HTTP] !== "true") {
    throw new Error(
      `This request carried no access token. Sign in with OAuth, or set ${ENV_ALLOW_ENV_CREDENTIALS_OVER_HTTP}=true to use the server's environment credentials.`,
    );
  }

  return new PloneClient({});
}
