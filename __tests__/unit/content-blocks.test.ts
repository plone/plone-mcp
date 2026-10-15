import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildBlocksFromSpecs,
  processBlocksForContent,
} from "plone-mcp/utils/content-blocks";
import * as BlockUtils from "plone-mcp/utils/block-utils";

describe("content-blocks", () => {
  beforeEach(() => {
    let idCounter = 0;
    vi.spyOn(BlockUtils, "generateBlockId").mockImplementation(
      () => `mock-id-${++idCounter}`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildBlocksFromSpecs", () => {
    it("converts specs into blocks, in order", async () => {
      const result = await buildBlocksFromSpecs([
        { type: "slate", data: { text: "Hello World" } },
        { type: "teaser", data: { href: "/some-path" } },
      ], "https://example.com");

      expect(result.blocks_layout.items).toEqual(["mock-id-1", "mock-id-2"]);
      expect(result.blocks["mock-id-1"]).toMatchObject({
        "@type": "slate",
        plaintext: "Hello World",
      });
      expect(result.blocks["mock-id-2"]).toMatchObject({
        "@type": "teaser",
        href: [{ "@id": "https://example.com/some-path" }],
      });
    });

    it("returns an empty layout for no specs", async () => {
      expect(await buildBlocksFromSpecs([])).toEqual({
        blocks: {},
        blocks_layout: { items: [] },
      });
    });

    it("checks image URLs before converting anything", async () => {
      vi.spyOn(BlockUtils, "validateImageURL").mockResolvedValue(false);
      const processBlock = vi.spyOn(BlockUtils, "processBlock");

      await expect(
        buildBlocksFromSpecs([
          { type: "slate", data: { text: "Hello" } },
          { type: "image", data: { url: "http://example.com/a.jpg" } },
        ], "https://example.com"),
      ).rejects.toThrow(
        "block_specs[1] (image): Invalid or inaccessible image URL: http://example.com/a.jpg",
      );
      expect(BlockUtils.validateImageURL).toHaveBeenCalledWith(
        "http://example.com/a.jpg",
        "https://example.com",
      );
      expect(processBlock).toHaveBeenCalledTimes(1);
    });

    it("names the spec that fails to convert", async () => {
      vi.spyOn(BlockUtils, "processBlock").mockImplementation((type) => {
        if (type === "teaser") throw new Error("Mock processing error");
        return { "@type": type };
      });

      await expect(
        buildBlocksFromSpecs([
          { type: "slate", data: { text: "Hello" } },
          { type: "teaser", data: {} },
        ]),
      ).rejects.toThrow("block_specs[1] (teaser): Mock processing error");
    });
  });

  describe("processBlocksForContent", () => {
    it("returns null for updates without blocks", () => {
      expect(processBlocksForContent({ isUpdate: true })).toBeNull();
    });

    it("creates a title block for new content without blocks", () => {
      const result = processBlocksForContent({});

      expect(result).toEqual({
        blocks: { "mock-id-1": { "@type": "title" } },
        blocks_layout: { items: ["mock-id-1"] },
      });
    });

    it("processes raw blocks and moves the title block first", () => {
      const result = processBlocksForContent({
        blocks: {
          id1: { "@type": "listing", query: [] },
          id2: { "@type": "title", extra: "dropped" },
        },
        blocks_layout: { items: ["id1", "id2"] },
      });

      expect(result?.blocks_layout.items).toEqual(["id2", "id1"]);
      expect(result?.blocks.id2).toEqual({ "@type": "title" });
      expect(result?.blocks.id1).toEqual({ "@type": "listing", query: [] });
    });

    it("appends raw blocks that are missing from the layout", () => {
      const result = processBlocksForContent({
        blocks: {
          title: { "@type": "title" },
          listed: { "@type": "listing" },
          unlisted: { "@type": "listing" },
        },
        blocks_layout: { items: ["title", "listed"] },
      });

      expect(result?.blocks_layout.items).toEqual([
        "title",
        "listed",
        "unlisted",
      ]);
    });

    it("drops layout ids that have no matching block", () => {
      const result = processBlocksForContent({
        blocks: { real: { "@type": "listing" } },
        blocks_layout: { items: ["ghost", "real"] },
      });

      expect(result?.blocks_layout.items).toEqual(["mock-id-1", "real"]);
      expect(result?.blocks.ghost).toBeUndefined();
    });

    it("uses built blocks as they are and adds a title block", () => {
      const processBlock = vi.spyOn(BlockUtils, "processBlock");
      const built = {
        blocks: { b1: { "@type": "slate", plaintext: "Built" } },
        blocks_layout: { items: ["b1"] },
      };

      const result = processBlocksForContent({ built, isUpdate: true });

      expect(result?.blocks_layout.items).toEqual(["mock-id-1", "b1"]);
      expect(result?.blocks.b1).toEqual(built.blocks.b1);
      expect(processBlock).not.toHaveBeenCalled();
    });
  });
});
