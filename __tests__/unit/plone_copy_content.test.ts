import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneCopyContent } from "plone-mcp/tools/plone_copy_content";
import { getClient } from "plone-mcp/connection";
import { wrapError } from "plone-mcp/utils/block-utils";

vi.mock("plone-mcp/connection", () => ({
  getClient: vi.fn(),
}));

vi.mock("plone-mcp/utils/block-utils", () => ({
  wrapError: vi.fn(),
}));

describe("plone_copy_content", () => {
  let mockClient: any;
  const mockContext = createMockContext();

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      post: vi.fn(),
    };

    (getClient as any).mockReturnValue(mockClient);
  });

  describe("config", () => {
    it("should have correct name and description", () => {
      expect(ploneCopyContent.config.name).toBe("plone_copy_content");
      expect(ploneCopyContent.config.description).toContain("Copies");
    });

    it("should have correct inputSchema", () => {
      const schema = ploneCopyContent.config.inputSchema as any;
      expect(schema.shape.parentPath).toBeDefined();
      expect(schema.shape.source).toBeDefined();
    });

    it("should reject an empty source array", () => {
      const schema = ploneCopyContent.config.inputSchema as any;
      expect(schema.safeParse({ parentPath: "/", source: [] }).success).toBe(
        false,
      );
    });

    it("should reject an empty source string", () => {
      const schema = ploneCopyContent.config.inputSchema as any;
      expect(schema.safeParse({ parentPath: "/", source: "" }).success).toBe(
        false,
      );
    });
  });

  describe("handler", () => {
    it("should copy a single source", async () => {
      const response = [
        { source: "https://example.com/front-page", target: "https://example.com/folder/copy_of_front-page" },
      ];
      mockClient.post.mockResolvedValue(response);

      const result = await ploneCopyContent.handler(
        { parentPath: "/folder", source: "/front-page" },
        mockContext,
      );

      expect(mockClient.post).toHaveBeenCalledWith("/folder/@copy", {
        source: "/front-page",
      });
      expect(JSON.parse(result.content[0].text)).toEqual(response);
      expect(result.content).toHaveLength(1);
    });

    it("should pass an array of sources through unchanged", async () => {
      const sources = ["/a", "/b"];
      mockClient.post.mockResolvedValue([
        { source: "/a", target: "/folder/copy_of_a" },
        { source: "/b", target: "/folder/copy_of_b" },
      ]);

      const result = await ploneCopyContent.handler(
        { parentPath: "/folder", source: sources },
        mockContext,
      );

      expect(mockClient.post).toHaveBeenCalledWith("/folder/@copy", {
        source: sources,
      });
      expect(result.content).toHaveLength(1);
    });

    it("should warn when the API drops unresolved sources", async () => {
      mockClient.post.mockResolvedValue([
        { source: "/a", target: "/folder/copy_of_a" },
      ]);

      const result = await ploneCopyContent.handler(
        { parentPath: "/folder", source: ["/a", "/missing"] },
        mockContext,
      );

      expect(result.content).toHaveLength(2);
      expect(result.content[1].text).toContain("1 of 2 source(s)");
    });

    it("should get the client from the request context", async () => {
      mockClient.post.mockResolvedValue([]);

      await ploneCopyContent.handler(
        { parentPath: "/folder", source: "/a" },
        mockContext,
      );

      expect(getClient).toHaveBeenCalledWith(mockContext);
    });

    it("should wrap API errors", async () => {
      const apiError = new Error("Conflict");
      mockClient.post.mockRejectedValue(apiError);
      const wrappedError = new Error("CopyContent: Conflict");
      (wrapError as any).mockReturnValue(wrappedError);

      await expect(
        ploneCopyContent.handler(
          { parentPath: "/folder", source: "/a" },
          mockContext,
        ),
      ).rejects.toThrow(wrappedError);

      expect(wrapError).toHaveBeenCalledWith("CopyContent", apiError);
    });
  });
});
