import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import {
  PloneClient,
  resolveConfig,
  isValidUrl,
  ENV_BASE_URL,
  ENV_USERNAME,
  ENV_PASSWORD,
  ENV_TOKEN,
} from "../../src/plone-client";

vi.mock("axios", () => {
  return {
    default: {
      create: vi.fn(() => ({
        defaults: {
          headers: {
            common: {},
          },
        },
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
      })),
    },
  };
});

describe("plone-client", () => {
  describe("isValidUrl", () => {
    it("should return true for valid URLs", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("http://localhost:8080/Plone")).toBe(true);
    });

    it("should return false for invalid URLs", () => {
      expect(isValidUrl("not-a-url")).toBe(false);
      expect(isValidUrl("")).toBe(false);
    });
  });

  describe("resolveConfig", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env[ENV_BASE_URL];
      delete process.env[ENV_USERNAME];
      delete process.env[ENV_PASSWORD];
      delete process.env[ENV_TOKEN];
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should resolve from provided config", () => {
      const config = {
        baseUrl: "https://plone.example.com",
        username: "admin",
        password: "password",
      };
      const resolved = resolveConfig(config);
      expect(resolved.baseUrl).toBe("https://plone.example.com");
      expect(resolved.username).toBe("admin");
      expect(resolved.password).toBe("password");
    });

    it("should resolve from environment variables", () => {
      process.env[ENV_BASE_URL] = "https://env.example.com";
      process.env[ENV_USERNAME] = "env-user";
      process.env[ENV_PASSWORD] = "env-pass";
      process.env[ENV_TOKEN] = "env-token";

      const resolved = resolveConfig({});
      expect(resolved.baseUrl).toBe("https://env.example.com");
      expect(resolved.username).toBe("env-user");
      expect(resolved.password).toBe("env-pass");
      expect(resolved.token).toBe("env-token");
    });

    it("should prioritize explicit config over environment variables", () => {
      process.env[ENV_BASE_URL] = "https://env.example.com";
      const config = { baseUrl: "https://explicit.example.com" };
      const resolved = resolveConfig(config);
      expect(resolved.baseUrl).toBe("https://explicit.example.com");
    });

    it("should throw if baseUrl is missing", () => {
      expect(() => resolveConfig({})).toThrow(/Base URL is required/);
    });

    it("should throw if baseUrl is an empty string", () => {
      expect(() => resolveConfig({ baseUrl: "" })).toThrow(/baseUrl cannot be an empty string/);
    });

    it("should throw if baseUrl is invalid", () => {
      expect(() => resolveConfig({ baseUrl: "invalid-url" })).toThrow(/Invalid base URL/);
    });
  });

  describe("PloneClient", () => {
    const config = { baseUrl: "https://example.com/Plone" };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should normalize baseUrl by removing trailing slash", () => {
      const client = new PloneClient({ baseUrl: "https://example.com/Plone/" });
      expect(client.baseUrl).toBe("https://example.com/Plone");
    });

    it("should configure axios with correct baseURL and headers", () => {
      new PloneClient(config);
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://example.com/Plone/++api++",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
        })
      );
    });

    it("should set Authorization header if token is provided", () => {
      new PloneClient({ ...config, token: "my-token" });
      const mockAxiosInstance = vi.mocked(axios.create).mock.results[0].value;
      expect(mockAxiosInstance.defaults.headers.common["Authorization"]).toBe("Bearer my-token");
    });

    it("should set basic auth if username and password are provided", () => {
      new PloneClient({ ...config, username: "user", password: "pwd" });
      const mockAxiosInstance = vi.mocked(axios.create).mock.results[0].value;
      expect(mockAxiosInstance.defaults.auth).toEqual({
        username: "user",
        password: "pwd",
      });
    });

    describe("normalizePath", () => {
      const client = new PloneClient(config);

      it("should handle empty or null paths", () => {
        expect(client.normalizePath("")).toBe("");
        // @ts-expect-error - testing runtime behavior with a non-string path
        expect(client.normalizePath(null)).toBe("");
      });

      it("should ensure leading slash and remove trailing slash", () => {
        expect(client.normalizePath("folder")).toBe("/folder");
        expect(client.normalizePath("/folder/")).toBe("/folder");
        expect(client.normalizePath("folder/sub/")).toBe("/folder/sub");
      });

      it("should return empty string for /", () => {
        expect(client.normalizePath("/")).toBe("");
      });
    });

    describe("HTTP methods", () => {
      let client: PloneClient;
      let mockAxios: any;

      beforeEach(() => {
        vi.clearAllMocks();
        client = new PloneClient(config);
        mockAxios = vi.mocked(axios.create).mock.results[0].value;
      });

      it("get should call axios.get with normalized path", async () => {
        mockAxios.get.mockResolvedValue({ data: { success: true } });
        const result = await client.get("some/path", { p: 1 });
        expect(mockAxios.get).toHaveBeenCalledWith("/some/path", { params: { p: 1 } });
        expect(result).toEqual({ success: true });
      });

      it("post should call axios.post with normalized path", async () => {
        mockAxios.post.mockResolvedValue({ data: { id: "new" } });
        const result = await client.post("create", { title: "New" });
        expect(mockAxios.post).toHaveBeenCalledWith("/create", { title: "New" });
        expect(result).toEqual({ id: "new" });
      });

      it("patch should call axios.patch with normalized path", async () => {
        mockAxios.patch.mockResolvedValue({ data: { updated: true } });
        const result = await client.patch("update", { title: "Updated" });
        expect(mockAxios.patch).toHaveBeenCalledWith("/update", { title: "Updated" });
        expect(result).toEqual({ updated: true });
      });

      it("delete should call axios.delete with normalized path", async () => {
        mockAxios.delete.mockResolvedValue({ data: { deleted: true } });
        const result = await client.delete("remove");
        expect(mockAxios.delete).toHaveBeenCalledWith("/remove", {
          data: undefined,
        });
        expect(result).toEqual({ deleted: true });
      });

      it("delete should pass a request body when data is provided", async () => {
        mockAxios.delete.mockResolvedValue({ data: { deleted: true } });
        await client.delete("remove", { language: "de" });
        expect(mockAxios.delete).toHaveBeenCalledWith("/remove", {
          data: { language: "de" },
        });
      });
    });
  });
});
