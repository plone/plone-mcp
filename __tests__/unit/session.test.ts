import { describe, it, expect } from "vitest";
import { getHeaderValue, getSessionId } from "../../src/utils/session";

describe("session-utils", () => {
  describe("getHeaderValue", () => {
    it("should return undefined for null/undefined headers", () => {
      expect(getHeaderValue(null, "some-header")).toBeUndefined();
      expect(getHeaderValue(undefined, "some-header")).toBeUndefined();
    });

    it("should return header value from object property access (case-insensitive)", () => {
      const headers = { "mcp-session-id": "session-1" };
      expect(getHeaderValue(headers, "mcp-session-id")).toBe("session-1");
      expect(getHeaderValue(headers, "MCP-SESSION-ID")).toBe("session-1");
    });

    it("should return header value using get() method if available", () => {
      const headers = {
        get: (name: string) => (name === "mcp-session-id" ? "session-2" : null)
      };
      expect(getHeaderValue(headers, "mcp-session-id")).toBe("session-2");
    });

    it("should handle array of values", () => {
      const headers = { "x-multi": ["val1", "val2"] };
      expect(getHeaderValue(headers, "x-multi")).toBe("val1");
    });

    it("should return undefined for missing headers", () => {
      const headers = { "other": "val" };
      expect(getHeaderValue(headers, "mcp-session-id")).toBeUndefined();
    });
  });

  describe("getSessionId", () => {
    it("should return the session id if present", () => {
      const headers = { "mcp-session-id": "session-xyz" };
      expect(getSessionId(headers)).toBe("session-xyz");
    });

    it("should return 'default' if session id is missing", () => {
      expect(getSessionId({})).toBe("default");
      expect(getSessionId(null)).toBe("default");
    });
  });
});
