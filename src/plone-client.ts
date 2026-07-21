import axios, { AxiosInstance } from "axios";
import { z } from "zod";

// Environment variable names for configuration
export const ENV_BASE_URL = "PLONE_BASE_URL";
export const ENV_USERNAME = "PLONE_USERNAME";
export const ENV_PASSWORD = "PLONE_PASSWORD";
export const ENV_TOKEN = "PLONE_TOKEN";

// Helper to validate URL format
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Configuration schema - all fields are optional to allow environment variable fallback
// Note: Using simple optional() without refine() to avoid Zod version compatibility issues
// with xmcp's bundled Zod. Validation is done in resolveConfig() instead.
export const ConfigSchema = z.object({
  baseUrl: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Resolves configuration by merging provided config with environment variables.
 * Environment variables are used as fallback when config values are not provided.
 *
 * Supported environment variables:
 * - PLONE_BASE_URL: Base URL of the Plone site
 * - PLONE_USERNAME: Username for authentication
 * - PLONE_PASSWORD: Password for authentication
 * - PLONE_TOKEN: JWT token for authentication
 */
export function resolveConfig(config: Config): Config & { baseUrl: string } {
  // Validate that string values are not empty
  if (config.baseUrl !== undefined && config.baseUrl.trim() === "") {
    throw new Error(
      "baseUrl cannot be an empty string. Omit the parameter to use PLONE_BASE_URL environment variable.",
    );
  }
  if (config.username !== undefined && config.username.trim() === "") {
    throw new Error(
      "username cannot be an empty string. Omit the parameter to use PLONE_USERNAME environment variable.",
    );
  }
  if (config.password !== undefined && config.password.trim() === "") {
    throw new Error(
      "password cannot be an empty string. Omit the parameter to use PLONE_PASSWORD environment variable.",
    );
  }
  if (config.token !== undefined && config.token.trim() === "") {
    throw new Error(
      "token cannot be an empty string. Omit the parameter to use PLONE_TOKEN environment variable.",
    );
  }

  const baseUrl = config.baseUrl || process.env[ENV_BASE_URL];
  const username = config.username || process.env[ENV_USERNAME];
  const password = config.password || process.env[ENV_PASSWORD];
  const token = config.token || process.env[ENV_TOKEN];

  // Validate baseUrl exists and is not empty
  if (!baseUrl || baseUrl.trim() === "") {
    throw new Error(
      `Base URL is required. Provide it via config.baseUrl or ${ENV_BASE_URL} environment variable.`,
    );
  }

  if (!isValidUrl(baseUrl)) {
    throw new Error(`Invalid base URL: ${baseUrl}`);
  }

  return {
    baseUrl,
    username,
    password,
    token,
  };
}

// Plone content interface
export interface PloneContent {
  "@type": string;
  title: string;
  blocks?: Record<string, unknown>;
  blocks_layout?: { items: string[] };
  [key: string]: unknown;
}

/**
 * HTTP client for communicating with Plone REST API
 */
export class PloneClient {
  private axios: AxiosInstance;
  public config: Config & { baseUrl: string };
  public readonly baseUrl: string;
  public readonly token?: string;

  constructor(config: Config) {
    this.config = resolveConfig(config);
    const normalizedBaseUrl = this.config.baseUrl.replace(/\/$/, "");
    this.config = { ...this.config, baseUrl: normalizedBaseUrl };
    this.baseUrl = normalizedBaseUrl;
    this.token = this.config.token;

    this.axios = axios.create({
      baseURL: `${this.baseUrl}/++api++`,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    // Set up authentication
    if (this.token) {
      this.axios.defaults.headers.common["Authorization"] =
        `Bearer ${this.token}`;
    } else if (this.config.username && this.config.password) {
      this.axios.defaults.auth = {
        username: this.config.username,
        password: this.config.password,
      };
    }
  }

  // IMPROVEMENT: Centralize path normalization
  normalizePath(path: string): string {
    if (!path || path === "/") return "";
    
    // Mitigate path traversal
    if (path.includes("..")) {
      throw new Error("Path traversal not allowed");
    }

    // Remove trailing slash, ensure leading slash
    let normalized = path.replace(/\/$/, "");
    if (!normalized.startsWith("/") && normalized !== "") {
      normalized = `/${normalized}`;
    }
    return normalized;
  }

  async get(path: string, params?: Record<string, unknown>): Promise<unknown> {
    const normalizedPath = this.normalizePath(path);
    const response = await this.axios.get(normalizedPath, { params });
    return response.data;
  }

  async post(path: string, data?: unknown): Promise<unknown> {
    const normalizedPath = this.normalizePath(path);
    const response = await this.axios.post(normalizedPath, data);
    return response.data;
  }

  async patch(path: string, data?: unknown): Promise<unknown> {
    const normalizedPath = this.normalizePath(path);
    const response = await this.axios.patch(normalizedPath, data);
    return response.data;
  }

  async delete(
    path: string,
    data?: Record<string, unknown>,
  ): Promise<unknown> {
    const normalizedPath = this.normalizePath(path);
    const response = await this.axios.delete(normalizedPath, { data });
    return response.data;
  }
}
