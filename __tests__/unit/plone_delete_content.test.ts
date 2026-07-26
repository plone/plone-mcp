import { describe, it, expect, vi, beforeEach } from "vitest";
import { ploneDeleteContent } from "plone-mcp/tools/plone_delete_content";
import { sessionManager } from "plone-mcp/session-manager";
import { wrapError } from "plone-mcp/utils/block-utils";

// Mock dependencies
vi.mock("plone-mcp/session-manager", () => ({
  sessionManager: {
    getSession: vi.fn(),
  },
}));

vi.mock("plone-mcp/utils/block-utils", () => ({
  wrapError: vi.fn(),
}));

describe("plone_delete_content", () => {
  let mockClient: any;
  let mockService: any;
  const sessionId = "test-session-id";
  const mockExtra = {
    sessionId,
    signal: new AbortController().signal,
    requestId: "test-request-id",
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      delete: vi.fn(),
    };

    mockService = {
      getClient: vi.fn().mockReturnValue(mockClient),
    };

    (sessionManager.getSession as any).mockReturnValue(mockService);
  });

  describe("config", () => {
    it("should have correct name and description", () => {
      expect(ploneDeleteContent.config.name).toBe("plone_delete_content");
      expect(ploneDeleteContent.config.description).toContain(
        "Permanently deletes a content item",
      );
    });

    it("should have correct inputSchema", () => {
      const schema = ploneDeleteContent.config.inputSchema as any;
      expect(schema.shape.path).toBeDefined();
    });
  });

  describe("handler", () => {
    it("should delete content successfully", async () => {
      const testPath = "/test-document";
      mockClient.delete.mockResolvedValue(undefined);

      const result = await ploneDeleteContent.handler({ path: testPath }, mockExtra);

      expect(mockClient.delete).toHaveBeenCalledWith(testPath);
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: `Successfully deleted content at path: ${testPath} `,
          },
        ],
      });
    });

    it("should handle root path deletion", async () => {
      const testPath = "/";
      mockClient.delete.mockResolvedValue(undefined);

      const result = await ploneDeleteContent.handler({ path: testPath }, mockExtra);

      expect(mockClient.delete).toHaveBeenCalledWith(testPath);
      expect(result.content[0].text).toContain(
        "Successfully deleted content at path: /",
      );
    });

    it("should handle nested path deletion", async () => {
      const testPath = "/folder/subfolder/document";
      mockClient.delete.mockResolvedValue(undefined);

      const result = await ploneDeleteContent.handler({ path: testPath }, mockExtra);

      expect(mockClient.delete).toHaveBeenCalledWith(testPath);
      expect(result.content[0].text).toContain(testPath);
    });

    it("should use correct session management", async () => {
      const testPath = "/test-doc";
      mockClient.delete.mockResolvedValue(undefined);

      await ploneDeleteContent.handler({ path: testPath }, mockExtra);

      expect(sessionManager.getSession).toHaveBeenCalledWith(sessionId);
      expect(mockService.getClient).toHaveBeenCalled();
    });

    it("should handle API errors with wrapError", async () => {
      const testPath = "/non-existent";
      const apiError = new Error("Content not found");
      mockClient.delete.mockRejectedValue(apiError);

      const wrappedError = new Error("DeleteContent: Content not found");
      (wrapError as any).mockReturnValue(wrappedError);

      await expect(ploneDeleteContent.handler({ path: testPath }, mockExtra)).rejects.toThrow(
        wrappedError,
      );

      expect(wrapError).toHaveBeenCalledWith("DeleteContent", apiError);
    });

    it("should handle network errors", async () => {
      const testPath = "/test-doc";
      const networkError = new Error("Network timeout");
      mockClient.delete.mockRejectedValue(networkError);

      const wrappedError = new Error("DeleteContent: Network timeout");
      (wrapError as any).mockReturnValue(wrappedError);

      await expect(ploneDeleteContent.handler({ path: testPath }, mockExtra)).rejects.toThrow(
        wrappedError,
      );

      expect(wrapError).toHaveBeenCalledWith("DeleteContent", networkError);
    });

    it("should handle empty path gracefully", async () => {
      const testPath = "";
      mockClient.delete.mockResolvedValue(undefined);

      const result = await ploneDeleteContent.handler({ path: testPath }, mockExtra);

      expect(mockClient.delete).toHaveBeenCalledWith(testPath);
      expect(result.content[0].text).toContain(
        "Successfully deleted content at path: ",
      );
    });

    it("should handle special characters in path", async () => {
      const testPath = "/folder with spaces/document-with-dashes_123";
      mockClient.delete.mockResolvedValue(undefined);

      const result = await ploneDeleteContent.handler({ path: testPath }, mockExtra);

      expect(mockClient.delete).toHaveBeenCalledWith(testPath);
      expect(result.content[0].text).toContain(testPath);
    });
  });

  describe("return value structure", () => {
    it("should return correct structure", async () => {
      const testPath = "/test";
      mockClient.delete.mockResolvedValue(undefined);

      const result = await ploneDeleteContent.handler({ path: testPath }, mockExtra);

      expect(result).toHaveProperty("content");
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty("type", "text");
      expect(result.content[0]).toHaveProperty("text");
      expect(typeof result.content[0].text).toBe("string");
    });
  });
});
