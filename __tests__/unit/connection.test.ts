import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getClient,
  ENV_ALLOW_ENV_CREDENTIALS_OVER_HTTP,
} from "plone-mcp/connection";
import {
  ENV_BASE_URL,
  ENV_USERNAME,
  ENV_PASSWORD,
  ENV_TOKEN,
} from "plone-mcp/plone-client";
import { createMockContext } from "../utils/test-helpers";
import type { AuthInfo } from "@modelcontextprotocol/server";

const baseUrl = "https://test.plone.com";

const authInfo = (token: string): AuthInfo => ({
  token,
  clientId: "plone-mcp",
  scopes: [],
});

describe("getClient", () => {
  beforeEach(() => {
    for (const name of [
      ENV_BASE_URL,
      ENV_USERNAME,
      ENV_PASSWORD,
      ENV_TOKEN,
      ENV_ALLOW_ENV_CREDENTIALS_OVER_HTTP,
    ]) {
      vi.stubEnv(name, undefined);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("stdio", () => {
    it("uses the environment credentials", () => {
      vi.stubEnv(ENV_BASE_URL, baseUrl);
      vi.stubEnv(ENV_TOKEN, "env-token");

      const client = getClient(createMockContext());

      expect(client.baseUrl).toBe(baseUrl);
      expect(client.token).toBe("env-token");
    });

    it("throws when the base URL is missing", () => {
      expect(() => getClient(createMockContext())).toThrow(
        "Base URL is required",
      );
    });
  });

  describe("HTTP", () => {
    it("uses the request's access token with the configured base URL", () => {
      vi.stubEnv(ENV_BASE_URL, baseUrl);
      vi.stubEnv(ENV_TOKEN, "env-token");

      const client = getClient(
        createMockContext({ http: { authInfo: authInfo("user-token") } }),
      );

      expect(client.baseUrl).toBe(baseUrl);
      expect(client.token).toBe("user-token");
    });

    it("rejects a request without a token by default", () => {
      vi.stubEnv(ENV_BASE_URL, baseUrl);
      vi.stubEnv(ENV_TOKEN, "env-token");

      expect(() => getClient(createMockContext({ http: {} }))).toThrow(
        ENV_ALLOW_ENV_CREDENTIALS_OVER_HTTP,
      );
    });

    it("falls back to the environment credentials when allowed", () => {
      vi.stubEnv(ENV_BASE_URL, baseUrl);
      vi.stubEnv(ENV_TOKEN, "env-token");
      vi.stubEnv(ENV_ALLOW_ENV_CREDENTIALS_OVER_HTTP, "true");

      const client = getClient(createMockContext({ http: {} }));

      expect(client.token).toBe("env-token");
    });

    it("keeps requests with different tokens apart", () => {
      vi.stubEnv(ENV_BASE_URL, baseUrl);

      const first = getClient(
        createMockContext({ http: { authInfo: authInfo("token-a") } }),
      );
      const second = getClient(
        createMockContext({ http: { authInfo: authInfo("token-b") } }),
      );

      expect(first).not.toBe(second);
      expect(first.token).toBe("token-a");
      expect(second.token).toBe("token-b");
    });
  });
});
