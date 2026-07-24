import { describe, it, expect, vi, beforeEach } from "vitest";
import { PloneService } from "../../src/plone-service";
import { PloneClient } from "../../src/plone-client";
import * as blockUtils from "../../src/utils/block-utils";

vi.mock("../../src/utils/block-utils", () => ({
  generateBlockId: vi.fn(() => "mock-uuid"),
  processBlock: vi.fn((type, data) => ({ ...data, "@type": type, processed: true })),
}));

describe("PloneService", () => {
  let mockClient: PloneClient;
  let service: PloneService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      config: { baseUrl: "https://example.com" },
    } as unknown as PloneClient;
    service = new PloneService(mockClient);
  });

  describe("getClient", () => {
    it("should return the client if configured", () => {
      expect(service.getClient()).toBe(mockClient);
    });

    it("should throw if client is not configured", () => {
      const emptyService = new PloneService(null);
      expect(() => emptyService.getClient()).toThrow(/Plone client not configured/);
    });
  });

  describe("Prepared Blocks state", () => {
    it("should set and get prepared blocks", () => {
      const blocks = {
        blocks: { a: { "@type": "text" } },
        blocks_layout: { items: ["a"] },
        timestamp: Date.now(),
      };
      service.setPreparedBlocks(blocks);
      expect(service.getPreparedBlocks()).toEqual(blocks);
    });

    it("should clear prepared blocks", () => {
      service.setPreparedBlocks({
        blocks: {},
        blocks_layout: { items: [] },
        timestamp: Date.now(),
      });
      service.clearPreparedBlocks();
      expect(service.getPreparedBlocks()).toBeNull();
    });

    it("should expire prepared blocks after TTL", () => {
      vi.useFakeTimers();
      const now = Date.now();
      service.setPreparedBlocks({
        blocks: {},
        blocks_layout: { items: [] },
        timestamp: now,
      });

      // Advance time by 61 seconds (TTL is 60s)
      vi.advanceTimersByTime(61000);

      expect(service.getPreparedBlocks()).toBeNull();
      vi.useRealTimers();
    });
  });

  describe("processBlocksForContent", () => {
    it("should return null for updates with no blocks provided", () => {
      const result = service.processBlocksForContent(undefined, undefined, true);
      expect(result).toBeNull();
    });

    it("should create default title block for new content when nothing provided", () => {
      const result = service.processBlocksForContent(undefined, undefined, false);
      expect(result?.blocks_layout.items).toHaveLength(1);
      const titleId = result?.blocks_layout.items[0];
      expect(result?.blocks[titleId!]).toEqual({ "@type": "title" });
    });

    it("should process provided blocks and ensure title is first", () => {
      const blocks = {
        "id1": { "@type": "text", text: "Hello" },
        "id2": { "@type": "title" }
      };
      const layout = { items: ["id1", "id2"] };

      const result = service.processBlocksForContent(blocks, layout);

      expect(result?.blocks_layout.items[0]).toBe("id2");
      expect(result?.blocks["id2"]).toEqual({ "@type": "title" });
      expect(result?.blocks["id1"]).toEqual(expect.objectContaining({ "@type": "text", processed: true }));
      expect(blockUtils.processBlock).toHaveBeenCalled();
    });

    it("should use prepared blocks if no inline blocks provided", () => {
      const prepared = {
        blocks: { "p1": { "@type": "text" } },
        blocks_layout: { items: ["p1"] },
        timestamp: Date.now()
      };
      service.setPreparedBlocks(prepared);

      const result = service.processBlocksForContent(undefined, undefined);

      expect(result?.blocks_layout.items).toContain("p1");
      // Note: processBlocksForContent also adds/moves title block
      expect(result?.blocks_layout.items).toHaveLength(2); // p1 + title
      expect(service.getPreparedBlocks()).toBeNull(); // Should be cleared
    });

    it("should append provided blocks that are missing from the layout", () => {
      const blocks = {
        listed: { "@type": "text", text: "in layout" },
        unlisted: { "@type": "text", text: "not in layout" },
        title: { "@type": "title" },
      };
      const layout = { items: ["title", "listed"] };

      const result = service.processBlocksForContent(blocks, layout);

      expect(result?.blocks_layout.items).toEqual(["title", "listed", "unlisted"]);
      expect(result?.blocks["unlisted"]).toEqual(
        expect.objectContaining({ "@type": "text", processed: true }),
      );
    });

    it("should drop layout ids that have no matching block", () => {
      const blocks = {
        real: { "@type": "text", text: "exists" },
      };
      const layout = { items: ["ghost", "real"] };

      const result = service.processBlocksForContent(blocks, layout);

      expect(result?.blocks_layout.items).not.toContain("ghost");
      expect(result?.blocks_layout.items).toContain("real");
      expect(result?.blocks["ghost"]).toBeUndefined();
    });

    it("should prioritize inline blocks over prepared blocks", () => {
      const prepared = {
        blocks: { "p1": { "@type": "text", content: "prepared" } },
        blocks_layout: { items: ["p1"] },
        timestamp: Date.now()
      };
      service.setPreparedBlocks(prepared);

      const inlineBlocks = { "i1": { "@type": "text", content: "inline" } };
      const inlineLayout = { items: ["i1"] };

      const result = service.processBlocksForContent(inlineBlocks, inlineLayout);

      expect(result?.blocks_layout.items).toContain("i1");
      expect(result?.blocks_layout.items).not.toContain("p1");
    });
  });
});
