import { describe, it, expect, vi, beforeEach } from "vitest";
import { ploneMoveContent } from "plone-mcp/tools/plone_move_content";
import { sessionManager } from "plone-mcp/session-manager";
import { wrapError } from "plone-mcp/utils/block-utils";

vi.mock("plone-mcp/session-manager", () => ({
  sessionManager: {
    getSession: vi.fn(),
  },
}));

vi.mock("plone-mcp/utils/block-utils", () => ({
  wrapError: vi.fn(),
}));

describe("plone_move_content", () => {
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
      post: vi.fn(),
    };

    mockService = {
      getClient: vi.fn().mockReturnValue(mockClient),
    };

    (sessionManager.getSession as any).mockReturnValue(mockService);
  });

  describe("config", () => {
    it("should have correct name and description", () => {
      expect(ploneMoveContent.config.name).toBe("plone_move_content");
      expect(ploneMoveContent.config.description).toContain("Moves");
    });

    it("should have correct inputSchema", () => {
      const schema = ploneMoveContent.config.inputSchema as any;
      expect(schema.shape.parentPath).toBeDefined();
      expect(schema.shape.source).toBeDefined();
    });
  });

  describe("handler", () => {
    it("should move a single source", async () => {
      const response = [
        { source: "https://example.com/front-page", target: "https://example.com/folder/front-page" },
      ];
      mockClient.post.mockResolvedValue(response);

      const result = await ploneMoveContent.handler(
        { parentPath: "/folder", source: "/front-page" },
        mockExtra,
      );

      expect(mockClient.post).toHaveBeenCalledWith("/folder/@move", {
        source: "/front-page",
      });
      expect(JSON.parse(result.content[0].text)).toEqual(response);
      expect(result.content).toHaveLength(1);
    });

    it("should pass an array of sources through unchanged", async () => {
      const sources = ["/a", "/b"];
      mockClient.post.mockResolvedValue([
        { source: "/a", target: "/folder/a" },
        { source: "/b", target: "/folder/b" },
      ]);

      const result = await ploneMoveContent.handler(
        { parentPath: "/folder", source: sources },
        mockExtra,
      );

      expect(mockClient.post).toHaveBeenCalledWith("/folder/@move", {
        source: sources,
      });
      expect(result.content).toHaveLength(1);
    });

    it("should warn when the API drops unresolved sources", async () => {
      mockClient.post.mockResolvedValue([
        { source: "/a", target: "/folder/a" },
      ]);

      const result = await ploneMoveContent.handler(
        { parentPath: "/folder", source: ["/a", "/missing"] },
        mockExtra,
      );

      expect(result.content).toHaveLength(2);
      expect(result.content[1].text).toContain("1 of 2 source(s)");
    });

    it("should use the session from extra", async () => {
      mockClient.post.mockResolvedValue([]);

      await ploneMoveContent.handler(
        { parentPath: "/folder", source: "/a" },
        mockExtra,
      );

      expect(sessionManager.getSession).toHaveBeenCalledWith(sessionId);
      expect(mockService.getClient).toHaveBeenCalled();
    });

    it("should wrap API errors", async () => {
      const apiError = new Error("Forbidden");
      mockClient.post.mockRejectedValue(apiError);
      const wrappedError = new Error("MoveContent: Forbidden");
      (wrapError as any).mockReturnValue(wrappedError);

      await expect(
        ploneMoveContent.handler(
          { parentPath: "/folder", source: "/a" },
          mockExtra,
        ),
      ).rejects.toThrow(wrappedError);

      expect(wrapError).toHaveBeenCalledWith("MoveContent", apiError);
    });
  });
});
