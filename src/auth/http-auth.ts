import {
  getOAuthProtectedResourceMetadataUrl,
  requireBearerAuth,
  type AuthInfo,
  type OAuthProtectedResourceMetadata,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import {
  ENV_OAUTH_ALLOWED_CLIENT_IDS,
  ENV_OAUTH_ISSUER,
  createTokenVerifier,
  readOAuthConfig,
} from "./verifier.js";
import { ENV_ALLOW_ENV_CREDENTIALS_OVER_HTTP } from "../connection.js";
import { isValidUrl } from "../plone-client.js";

export const ENV_MCP_RESOURCE_URL = "PLONE_MCP_RESOURCE_URL";

const METADATA_PATH = "/.well-known/oauth-protected-resource";
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

interface OAuthSettings {
  issuer: string;
  metadata: OAuthProtectedResourceMetadata;
  metadataPaths: string[];
  metadataUrl: string;
  verifier: OAuthTokenVerifier;
}

export interface HttpAuth {
  oauth?: OAuthSettings;
  allowEnvCredentials: boolean;
}

const stripTrailingSlash = (path: string) =>
  path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

/**
 * Reads how HTTP requests are authenticated. Throws, naming the variables to
 * set, when the configuration is incomplete or when neither OAuth nor
 * PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP is set: the server never runs open.
 */
export function readHttpAuth(): HttpAuth {
  const allowEnvCredentials =
    process.env[ENV_ALLOW_ENV_CREDENTIALS_OVER_HTTP] === "true";
  const config = readOAuthConfig();
  if (!config) {
    if (!allowEnvCredentials) {
      throw new Error(
        `HTTP requires sign-in. Set ${ENV_OAUTH_ISSUER}, ${ENV_OAUTH_ALLOWED_CLIENT_IDS} and ${ENV_MCP_RESOURCE_URL}, or set ${ENV_ALLOW_ENV_CREDENTIALS_OVER_HTTP}=true to use the server's environment credentials.`,
      );
    }
    return { allowEnvCredentials };
  }

  const issuer = new URL(config.issuer);
  if (
    issuer.protocol !== "https:" &&
    !LOCAL_HOSTNAMES.includes(issuer.hostname)
  ) {
    throw new Error(`${ENV_OAUTH_ISSUER} must use https.`);
  }
  const resource = process.env[ENV_MCP_RESOURCE_URL];
  if (!resource || !isValidUrl(resource)) {
    throw new Error(
      `${ENV_OAUTH_ISSUER} is set, so ${ENV_MCP_RESOURCE_URL} must be this server's public URL, exactly as users enter it (for example https://mcp.example.com/mcp).`,
    );
  }

  const resourceUrl = new URL(resource);
  const resourcePath = stripTrailingSlash(resourceUrl.pathname);
  return {
    allowEnvCredentials,
    oauth: {
      issuer: config.issuer,
      // No scopes_supported: Plone needs none, and offline_access must never
      // be advertised.
      metadata: {
        resource,
        authorization_servers: [config.issuer],
        resource_name: "Plone MCP Server",
      },
      metadataPaths: [
        METADATA_PATH,
        ...(resourcePath === "/" ? [] : [METADATA_PATH + resourcePath]),
      ],
      metadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl),
      verifier: createTokenVerifier(config),
    },
  };
}

/**
 * Serves the RFC 9728 Protected Resource Metadata, which tells a client where
 * to sign in. Public and cacheable. Returns undefined for other paths.
 */
export function metadataResponse(
  request: Request,
  auth: HttpAuth,
): Response | undefined {
  const path = stripTrailingSlash(new URL(request.url).pathname);
  if (!path.startsWith(METADATA_PATH)) {
    return undefined;
  }
  if (!auth.oauth?.metadataPaths.includes(path)) {
    return new Response("Not found", { status: 404 });
  }
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=3600",
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: { ...headers, Allow: "GET, HEAD, OPTIONS" },
    });
  }
  const response = Response.json(auth.oauth.metadata, { headers });
  return request.method === "HEAD"
    ? new Response(null, { headers: response.headers })
    : response;
}

/**
 * Authenticates an MCP request from its Authorization header only.
 *
 * - OAuth on: a valid token gives its AuthInfo; no token or a bad one gives a
 *   401 challenge pointing at the metadata. A request without the header may
 *   use the environment credentials when they are allowed; a bad header never
 *   falls back.
 * - OAuth off: environment credentials (readHttpAuth made sure they are
 *   allowed), so undefined.
 */
export async function authenticate(
  request: Request,
  auth: HttpAuth,
): Promise<AuthInfo | Response | undefined> {
  if (!auth.oauth) {
    return undefined;
  }
  if (!request.headers.has("Authorization") && auth.allowEnvCredentials) {
    return undefined;
  }
  return requireBearerAuth({
    verifier: auth.oauth.verifier,
    resourceMetadataUrl: auth.oauth.metadataUrl,
  })(request);
}
