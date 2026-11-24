import { PloneClient } from "./plone-client.js";
import type { ServerContext } from "@modelcontextprotocol/server";

export const ENV_ALLOW_ENV_CREDENTIALS_OVER_HTTP =
  "PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP";

// Key of the callback the HTTP handler puts in authInfo.extra to learn that
// Plone refused the token.
export const ON_PLONE_UNAUTHORIZED = "onPloneUnauthorized";

/**
 * Builds a Plone client for the current request, without keeping any state.
 *
 * - HTTP with a verified access token: PLONE_BASE_URL plus that token.
 * - stdio: credentials from the environment.
 * - HTTP without a token: environment credentials, only when
 *   PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP is "true".
 */
export function getClient(ctx: ServerContext): PloneClient {
  const signal = ctx.mcpReq.signal;
  const authInfo = ctx.http?.authInfo;
  if (authInfo?.token) {
    // The MCP spec says not to pass a client's token on to another service.
    // Here the issuer and the API are the same Plone site, and pas-identity
    // cannot yet issue a token meant for this server alone.
    const onUnauthorized = authInfo.extra?.[ON_PLONE_UNAUTHORIZED];
    return new PloneClient(
      { token: authInfo.token },
      signal,
      typeof onUnauthorized === "function"
        ? (onUnauthorized as () => void)
        : undefined,
    );
  }

  if (ctx.http && process.env[ENV_ALLOW_ENV_CREDENTIALS_OVER_HTTP] !== "true") {
    throw new Error(
      `This request carried no access token. Sign in with OAuth, or set ${ENV_ALLOW_ENV_CREDENTIALS_OVER_HTTP}=true to use the server's environment credentials.`,
    );
  }

  return new PloneClient({}, signal);
}
