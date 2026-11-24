import {
  OAuthError,
  OAuthErrorCode,
  bearerAuthChallengeResponse,
  createMcpHandler,
  isLegacyRequest,
  type McpHandlerRequestOptions,
} from "@modelcontextprotocol/server";
import {
  authenticate,
  metadataResponse,
  readHttpAuth,
  type HttpAuth,
} from "./auth/http-auth.js";
import { isTokenRefused } from "./auth/verifier.js";
import { ENV_STATE_SECRET } from "./confirmation.js";
import { ON_PLONE_UNAUTHORIZED } from "./connection.js";
import { createServer } from "./server.js";

export const ENV_ALLOWED_ORIGINS = "PLONE_MCP_ALLOWED_ORIGINS";

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Browsers send an Origin; other clients do not. Only local pages and the
 * origins listed in PLONE_MCP_ALLOWED_ORIGINS (comma-separated) may call the
 * server from a browser, which blocks DNS rebinding.
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) {
    return true;
  }
  const allowed = (process.env[ENV_ALLOWED_ORIGINS] ?? "")
    .split(",")
    .map((entry) => entry.trim());
  if (allowed.includes(origin)) {
    return true;
  }
  try {
    return LOCAL_HOSTNAMES.includes(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/**
 * Web-standard MCP handler (Request -> Response). Every request gets a fresh
 * server from the factory, so any instance can answer any request.
 */
const mcpHandler = createMcpHandler(
  () => createServer({ stateKey: process.env[ENV_STATE_SECRET] }),
  {
    legacy: "stateless",
    responseMode: "json",
    onerror: (error) => console.error(`MCP request error: ${error.message}`),
  },
);

export const handler = {
  fetch: async (request: Request, options?: McpHandlerRequestOptions) => {
    // Read per request: no state, and a serverless host has no startup step.
    let auth: HttpAuth;
    try {
      auth = readHttpAuth();
    } catch (error) {
      console.error(`MCP server not configured: ${(error as Error).message}`);
      return new Response("MCP server not configured", { status: 500 });
    }

    const metadata = metadataResponse(request, auth);
    if (metadata) {
      return metadata;
    }

    const origin = request.headers.get("Origin");
    if (!isAllowedOrigin(origin)) {
      return new Response(`Origin not allowed: ${origin}`, { status: 403 });
    }

    // A host that already authenticated the request passes authInfo itself.
    let authInfo = options?.authInfo;
    if (!authInfo) {
      const result = await authenticate(request, auth);
      if (result instanceof Response) {
        return result;
      }
      authInfo = result;
    }

    // Lets operators see when 2025-era traffic has stopped.
    const legacy = await isLegacyRequest(request.clone(), options?.parsedBody);
    console.error(`MCP request: ${legacy ? "legacy" : "modern"}`);

    let ploneAnswered401 = false;
    const response = await mcpHandler.fetch(request, {
      ...options,
      authInfo: authInfo && {
        ...authInfo,
        extra: {
          ...authInfo.extra,
          [ON_PLONE_UNAUTHORIZED]: () => {
            ploneAnswered401 = true;
          },
        },
      },
    });
    // Plone no longer accepts the token (client disabled, keys rotated). JSON
    // responses are complete here, so the request can still answer with a
    // challenge: the client refreshes its token and retries. Any other 401 is
    // a missing permission and stays a tool error.
    if (
      ploneAnswered401 &&
      authInfo &&
      auth.oauth &&
      (await isTokenRefused(auth.oauth.issuer, authInfo.token))
    ) {
      await response.body?.cancel();
      return bearerAuthChallengeResponse(
        new OAuthError(
          OAuthErrorCode.InvalidToken,
          "Plone refused the access token",
        ),
        {
          resourceMetadataUrl:
            authInfo.resourceMetadataUrl ?? auth.oauth.metadataUrl,
        },
      );
    }
    return response;
  },
  close: () => mcpHandler.close(),
};
