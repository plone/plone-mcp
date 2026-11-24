import {
  OAuthError,
  OAuthErrorCode,
  type AuthInfo,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";

export const ENV_OAUTH_ISSUER = "PLONE_OAUTH_ISSUER";
export const ENV_OAUTH_ALLOWED_CLIENT_IDS = "PLONE_OAUTH_ALLOWED_CLIENT_IDS";

// Plone's JWKS keys carry no `alg`, so the algorithm is pinned here.
const ALGORITHMS = ["RS256"];
const CLOCK_TOLERANCE_SECONDS = 30;
// A token about to expire is refused up front, so the client refreshes before
// a tool starts rather than Plone refusing it halfway through.
const MIN_REMAINING_SECONDS = 60;
const FETCH_TIMEOUT_MS = 5000;

// jose codes that mean the keys could not be loaded, not that the token is bad.
const KEY_LOADING_ERROR_CODES = [
  errors.JOSEError.code,
  errors.JWKSTimeout.code,
  errors.JWKSInvalid.code,
];

export interface OAuthConfig {
  issuer: string;
  allowedClientIds: string[];
}

/**
 * Reads the OAuth settings. Returns undefined when PLONE_OAUTH_ISSUER is
 * unset (OAuth off) and throws when it is set without an allow-list.
 */
export function readOAuthConfig(): OAuthConfig | undefined {
  const issuer = process.env[ENV_OAUTH_ISSUER];
  if (!issuer) {
    return undefined;
  }
  const allowedClientIds = (process.env[ENV_OAUTH_ALLOWED_CLIENT_IDS] ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (allowedClientIds.length === 0) {
    throw new Error(
      `${ENV_OAUTH_ISSUER} is set but ${ENV_OAUTH_ALLOWED_CLIENT_IDS} is empty. List the OAuth client ids whose tokens this server accepts.`,
    );
  }
  return { issuer, allowedClientIds };
}

interface IssuerKeys {
  keySet: JWTVerifyGetKey;
  userinfoEndpoint?: string;
}

// Public signing keys per issuer. They are the same for every caller and can
// be refetched, so this is a cache, not request state. jose refetches on an
// unknown `kid` (key rotation), at most once per cooldown period.
const keySets = new Map<string, Promise<IssuerKeys>>();

async function loadKeySet(issuer: string): Promise<IssuerKeys> {
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Discovery returned HTTP ${response.status}`);
  }
  const metadata = (await response.json()) as {
    issuer?: unknown;
    jwks_uri?: unknown;
    userinfo_endpoint?: unknown;
  };
  if (metadata.issuer !== issuer) {
    throw new Error("Discovery document names a different issuer");
  }
  if (typeof metadata.jwks_uri !== "string") {
    throw new Error("Discovery document has no jwks_uri");
  }
  return {
    keySet: createRemoteJWKSet(new URL(metadata.jwks_uri), {
      timeoutDuration: FETCH_TIMEOUT_MS,
    }),
    userinfoEndpoint:
      typeof metadata.userinfo_endpoint === "string"
        ? metadata.userinfo_endpoint
        : undefined,
  };
}

function getKeySet(issuer: string): Promise<IssuerKeys> {
  let keySet = keySets.get(issuer);
  if (!keySet) {
    keySet = loadKeySet(issuer);
    keySets.set(issuer, keySet);
    // A failed load is retried by the next request.
    keySet.catch(() => keySets.delete(issuer));
  }
  return keySet;
}

/**
 * A bad token is a 401 the client can recover from by signing in again.
 * Failing to load the keys is our problem, so it is a 500. Neither message
 * says which check failed.
 */
function toOAuthError(error: unknown): OAuthError {
  if (error instanceof OAuthError) {
    return error;
  }
  if (
    error instanceof errors.JOSEError &&
    !KEY_LOADING_ERROR_CODES.includes(error.code)
  ) {
    return new OAuthError(OAuthErrorCode.InvalidToken, "Invalid access token");
  }
  return new OAuthError(
    OAuthErrorCode.ServerError,
    "Could not load the authorization server's signing keys",
  );
}

/**
 * Verifies Plone access tokens locally: signature against the issuer's keys,
 * RS256 only, `typ` at+jwt, `iss`, `exp` at least a minute away, `aud` in
 * the allow-list and `sub`.
 */
export function createTokenVerifier(config: OAuthConfig): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      try {
        const { keySet } = await getKeySet(config.issuer);
        const { payload } = await jwtVerify(token, keySet, {
          issuer: config.issuer,
          audience: config.allowedClientIds,
          algorithms: ALGORITHMS,
          typ: "at+jwt",
          clockTolerance: CLOCK_TOLERANCE_SECONDS,
          requiredClaims: ["exp", "sub"],
        });
        // pas-identity sets `aud` to the client id the token was issued to.
        const audiences = [payload.aud].flat();
        const clientId = config.allowedClientIds.find((id) =>
          audiences.includes(id),
        );
        if (
          !payload.sub ||
          !clientId ||
          (payload.exp ?? 0) - Date.now() / 1000 < MIN_REMAINING_SECONDS
        ) {
          throw new OAuthError(
            OAuthErrorCode.InvalidToken,
            "Invalid access token",
          );
        }
        return {
          token,
          clientId,
          scopes:
            typeof payload.scope === "string"
              ? payload.scope.split(" ").filter(Boolean)
              : [],
          expiresAt: payload.exp,
          extra: { userId: payload.sub },
        };
      } catch (error) {
        throw toOAuthError(error);
      }
    },
  };
}

/**
 * Asks the issuer's userinfo endpoint whether it still accepts the token.
 * Plone answers 401 both for a refused token and for a user who lacks
 * permission; only userinfo tells them apart. True only on a clear refusal.
 */
export async function isTokenRefused(
  issuer: string,
  token: string,
): Promise<boolean> {
  try {
    const { userinfoEndpoint } = await getKeySet(issuer);
    if (!userinfoEndpoint) {
      return false;
    }
    const response = await fetch(userinfoEndpoint, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    await response.body?.cancel();
    return response.status === 401;
  } catch {
    return false;
  }
}
