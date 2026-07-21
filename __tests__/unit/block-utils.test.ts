import { describe, it, expect, vi } from "vitest";
import {
  generateBlockId,
  normalizeUrl,
  normalizeHref,
  processBlock,
} from "../../src/utils/block-utils";
import { markdownParse } from "../../src/markdown-parser";

// Mock markdown parser
vi.mock("../../src/markdown-parser", () => ({
  markdownParse: vi.fn((text) => [{ type: "p", children: [{ text }] }]),
}));

// Mock fetch for validateImageURL if needed
// global.fetch = vi.fn();

describe("block-utils", () => {
  describe("generateBlockId", () => {
    it("should generate a valid UUID", () => {
      const id = generateBlockId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe("normalizeUrl", () => {
    it("should return absolute URLs as-is", () => {
      expect(normalizeUrl("https://example.com")).toBe("https://example.com");
    });

    it("should prepend baseUrl to relative paths starting with /", () => {
      expect(normalizeUrl("/folder/sub", "https://plone.com")).toBe("https://plone.com/folder/sub");
    });

    it("should not prepend baseUrl if path does not start with /", () => {
      expect(normalizeUrl("relative", "https://plone.com")).toBe("relative");
    });

    it("should not prepend baseUrl if it is not provided", () => {
      expect(normalizeUrl("/folder/sub")).toBe("/folder/sub");
    });
  });

  describe("normalizeHref", () => {
    it("should normalize string href to array of @id objects", () => {
      const result = normalizeHref("/page", "teaser", "https://plone.com");
      expect(result).toEqual([{ "@id": "https://plone.com/page" }]);
    });

    it("should normalize array of strings (wait, code only handles string or array of objects)", () => {
      const href = [{ "@id": "/page", title: "Page" }];
      const result = normalizeHref(href, "teaser", "https://plone.com");
      expect(result).toEqual([{ "@id": "https://plone.com/page", title: "Page" }]);
    });

    it("should throw for invalid formats", () => {
      expect(() => normalizeHref(123, "teaser")).toThrow(/Invalid href format/);
      expect(() => normalizeHref([], "teaser")).toThrow(/href cannot be empty/);
    });
  });

  describe("processBlock", () => {
    it("should process slate/text blocks by converting markdown", () => {
      const blockData = { text: "Hello **world**" };
      const result = processBlock("slate", blockData);

      expect(result["@type"]).toBe("slate");
      expect(result.plaintext).toBe("Hello **world**");
      expect(result.value).toEqual([{ type: "p", children: [{ text: "Hello **world**" }] }]);
      expect(markdownParse).toHaveBeenCalledWith("Hello **world**");
    });

    it("should process image blocks and validate URL presence", () => {
      expect(() => processBlock("image", {})).toThrow(/Missing or invalid image URL/);
      const result = processBlock("image", { url: "/img.png" });
      expect(result).toEqual({ "@type": "image", url: "/img.png" });
    });

    it("should process teaser blocks and normalize href", () => {
      const blockData = { href: "/news" };
      const result = processBlock("teaser", blockData, "https://plone.com");
      expect(result).toEqual({
        "@type": "teaser",
        href: [{ "@id": "https://plone.com/news" }]
      });
    });

    it("should process gridBlock recursively", () => {
      const blockData = {
        blocks: {
          "b1": { "@type": "text", text: "Grid item" }
        },
        blocks_layout: { items: ["b1"] }
      };

      const result = processBlock("gridBlock", blockData);

      expect(result["@type"]).toBe("gridBlock");
      const innerLayout = (result.blocks_layout as any).items;
      expect(innerLayout).toHaveLength(1);
      const innerBlockId = innerLayout[0];
      expect(innerBlockId).not.toBe("b1"); // Should be a new ID
      expect(result.blocks[innerBlockId]).toEqual(expect.objectContaining({
        "@type": "slate",
        plaintext: "Grid item"
      }));
    });

    it("should use default processor for unknown block types", () => {
      const result = processBlock("unknown", { some: "data" });
      expect(result).toEqual({ "@type": "unknown", some: "data" });
    });
  });
});
