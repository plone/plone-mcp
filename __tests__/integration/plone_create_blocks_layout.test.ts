import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { sessionManager } from "plone-mcp/session-manager";
import { ploneCreateBlocksLayout } from "plone-mcp/tools/plone_create_blocks_layout";
import * as BlockUtils from "plone-mcp/utils/block-utils";
import { PreparedBlocks } from "plone-mcp/plone-service"; // Import PreparedBlocks

// Define interfaces for the expected block structures in tests
interface SlateBlock {
  "@type": "slate";
  plaintext: string;
}

interface TeaserBlock {
  "@type": "teaser";
  title: string;
  href: { "@id": string }[];
}

interface ImageBlock {
  "@type": "image";
  url: string;
}

type Block = SlateBlock | TeaserBlock | ImageBlock | Record<string, unknown>;

// Extend PreparedBlocks to make 'blocks' property more specific for testing
interface TestPreparedBlocks extends PreparedBlocks {
  blocks: Record<string, Block>;
}

describe("plone_create_blocks_layout", () => {
  const sessionId = "test-session-id";
  const mockExtra = {
    sessionId,
    signal: new AbortController().signal,
    requestId: "test-request-id",
  } as any;

  beforeEach(() => {
    const service = sessionManager.getSession(sessionId);
    service.clearPreparedBlocks();
    vi.restoreAllMocks(); // Restore all mocks for clean slate
    vi.spyOn(BlockUtils, "validateImageURL").mockResolvedValue(true); // Default to valid image URLs
    let idCounter = 0;
    vi.spyOn(BlockUtils, "generateBlockId").mockImplementation(
      () => `mock-id-${++idCounter}`,
    ); // Mock ID generation
  });

  afterEach(() => {
    const service = sessionManager.getSession(sessionId);
    service.clearPreparedBlocks();
    vi.restoreAllMocks();
  });

  it("should successfully prepare a layout with text blocks", async () => {
    const args = {
      blocks: [
        { type: "text", data: { text: "Hello World" } },
        { type: "text", data: { text: "Another paragraph" } },
      ],
    };

    await ploneCreateBlocksLayout.handler(args, mockExtra);
    const service = sessionManager.getSession(sessionId);
    const preparedBlocks = service.getPreparedBlocks();

    expect(preparedBlocks).not.toBeNull();
    if (preparedBlocks) {
      // Type guard to narrow type
      const typedPreparedBlocks = preparedBlocks as TestPreparedBlocks;
      expect(typedPreparedBlocks.blocks_layout.items.length).toBe(2);
      expect(typedPreparedBlocks.blocks["mock-id-1"]["@type"]).toBe("slate"); // 'text' type becomes 'slate'
      expect(
        (typedPreparedBlocks.blocks["mock-id-1"] as SlateBlock).plaintext,
      ).toBe("Hello World");
      expect(typedPreparedBlocks.blocks["mock-id-2"]["@type"]).toBe("slate");
      expect(
        (typedPreparedBlocks.blocks["mock-id-2"] as SlateBlock).plaintext,
      ).toBe("Another paragraph");
    }
  });

  it("should successfully prepare a layout with a mix of block types", async () => {
    const args = {
      blocks: [
        { type: "text", data: { text: "Intro" } },
        {
          type: "teaser",
          data: { title: "My Teaser", href: "/some-path" },
        },
      ],
    };

    await ploneCreateBlocksLayout.handler(args, mockExtra);
    const service = sessionManager.getSession(sessionId);
    const preparedBlocks = service.getPreparedBlocks();

    expect(preparedBlocks).not.toBeNull();
    if (preparedBlocks) {
      // Type guard
      const typedPreparedBlocks = preparedBlocks as TestPreparedBlocks;
      expect(typedPreparedBlocks.blocks_layout.items.length).toBe(2);
      expect(typedPreparedBlocks.blocks["mock-id-1"]["@type"]).toBe("slate");
      expect(
        (typedPreparedBlocks.blocks["mock-id-1"] as SlateBlock).plaintext,
      ).toBe("Intro");
      expect(typedPreparedBlocks.blocks["mock-id-2"]["@type"]).toBe("teaser");
      expect(
        (typedPreparedBlocks.blocks["mock-id-2"] as TeaserBlock).title,
      ).toBe("My Teaser");
      expect(
        (typedPreparedBlocks.blocks["mock-id-2"] as TeaserBlock).href[0]["@id"],
      ).toBe("/some-path");
    }
  });

  it("should prepare a layout with an image block when URL is valid", async () => {
    vi.spyOn(BlockUtils, "validateImageURL").mockResolvedValue(true);
    const args = {
      blocks: [
        { type: "image", data: { url: "http://example.com/image.jpg" } },
      ],
    };

    await ploneCreateBlocksLayout.handler(args, mockExtra);
    const service = sessionManager.getSession(sessionId);
    const preparedBlocks = service.getPreparedBlocks();

    expect(preparedBlocks).not.toBeNull();
    if (preparedBlocks) {
      // Type guard
      const typedPreparedBlocks = preparedBlocks as TestPreparedBlocks;
      expect(typedPreparedBlocks.blocks["mock-id-1"]["@type"]).toBe("image");
      expect((typedPreparedBlocks.blocks["mock-id-1"] as ImageBlock).url).toBe(
        "http://example.com/image.jpg",
      );
    }
    expect(BlockUtils.validateImageURL).toHaveBeenCalledWith(
      "http://example.com/image.jpg",
      undefined,
    );
  });

  it("should throw an error if an image block has an invalid URL and clear prepared blocks", async () => {
    vi.spyOn(BlockUtils, "validateImageURL").mockResolvedValue(false);
    const args = {
      blocks: [
        { type: "image", data: { url: "http://invalid.com/image.jpg" } },
      ],
    };

    await expect(ploneCreateBlocksLayout.handler(args, mockExtra)).rejects.toThrow(
      "[CreateBlocksLayout] Invalid or inaccessible image URL: http://invalid.com/image.jpg",
    );
    expect(BlockUtils.validateImageURL).toHaveBeenCalledWith(
      "http://invalid.com/image.jpg",
      undefined,
    );
    const service = sessionManager.getSession(sessionId);
    expect(service.getPreparedBlocks()).toBeNull(); // Should be cleared on error
  });

  it("should prepare an empty layout if no blocks are provided", async () => {
    const args = { blocks: [] };
    const result = await ploneCreateBlocksLayout.handler(args, mockExtra);
    const service = sessionManager.getSession(sessionId);
    const preparedBlocks = service.getPreparedBlocks();

    expect(result.content[0].text).toContain("Successfully prepared 0 blocks");
    expect(preparedBlocks).not.toBeNull();
    expect(Object.keys(preparedBlocks?.blocks || {}).length).toBe(0);
    expect(preparedBlocks?.blocks_layout.items.length).toBe(0);
  });

  it("should clear prepared blocks if there is a block data processing error", async () => {
    vi.spyOn(BlockUtils, "processBlock").mockImplementation(() => {
      throw new Error("Mock processing error");
    });

    const args = {
      blocks: [{ type: "text", data: { text: "This will fail" } }],
    };

    await expect(ploneCreateBlocksLayout.handler(args, mockExtra)).rejects.toThrow(
      "[CreateBlocksLayout] Mock processing error",
    );
    const service = sessionManager.getSession(sessionId);
    expect(service.getPreparedBlocks()).toBeNull();
  });
});
