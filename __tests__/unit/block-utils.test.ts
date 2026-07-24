import { describe, it, expect, vi, afterEach } from "vitest";
import {
  generateBlockId,
  normalizeUrl,
  normalizeHref,
  processBlock,
  validateImageURL,
} from "../../src/utils/block-utils";
import { markdownParse } from "../../src/markdown-parser";

// Mock markdown parser
vi.mock("../../src/markdown-parser", () => ({
  markdownParse: vi.fn((text) => [{ type: "p", children: [{ text }] }]),
}));

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
        href: [{ "@id": "https://plone.com/news" }],
        overwrite: false
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
      const innerBlocks = result.blocks as Record<string, unknown>;
      expect(innerBlocks[innerBlockId]).toEqual(expect.objectContaining({
        "@type": "slate",
        plaintext: "Grid item"
      }));
    });

    it("should use default processor for unknown block types", () => {
      const result = processBlock("unknown", { some: "data" });
      expect(result).toEqual({ "@type": "unknown", some: "data" });
    });

    it("should default overwrite to false on a bare-href teaser", () => {
      // Plone's own deserializer treats a missing overwrite as true, so the
      // processor must pin the documented default explicitly.
      const result = processBlock("teaser", { href: "/my-page" }, "https://plone.com");
      expect(result).toEqual({
        "@type": "teaser",
        href: [{ "@id": "https://plone.com/my-page" }],
        overwrite: false,
      });
    });

    it("should preserve an explicit overwrite on teasers, including grid-nested ones", () => {
      const top = processBlock("teaser", { href: "/a", overwrite: true, title: "Custom" });
      expect(top.overwrite).toBe(true);

      const grid = processBlock("gridBlock", {
        blocks: { t: { "@type": "teaser", href: "/a" } },
        blocks_layout: { items: ["t"] },
      });
      const nested = Object.values(
        grid.blocks as Record<string, Record<string, unknown>>,
      )[0];
      expect(nested.overwrite).toBe(false);
    });
  });

  describe("validateImageURL", () => {
    const mockFetchResponse = (
      status: number,
      contentType?: string,
    ): Response =>
      ({
        ok: status >= 200 && status < 300,
        status,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type" ? (contentType ?? null) : null,
        },
      }) as unknown as Response;

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should accept image data URLs and reject non-image data URLs", async () => {
      await expect(validateImageURL("data:image/png;base64,abc")).resolves.toBe(true);
      await expect(validateImageURL("data:text/html,<h1>hi</h1>")).resolves.toBe(false);
    });

    it("should reject malformed URLs without fetching", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      await expect(validateImageURL("not a url")).resolves.toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should accept internal references without fetching", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      await expect(validateImageURL("/en/my-image")).resolves.toBe(true);
      await expect(validateImageURL("resolveuid/abc123")).resolves.toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should accept same-site absolute URLs without fetching", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      await expect(
        validateImageURL(
          "http://localhost:3000/en/my-image",
          "http://localhost:3000",
        ),
      ).resolves.toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should still probe absolute URLs on other hosts when baseUrl is set", async () => {
      const fetchSpy = vi
        .fn()
        .mockResolvedValue(mockFetchResponse(200, "text/html"));
      vi.stubGlobal("fetch", fetchSpy);

      await expect(
        validateImageURL("https://other.example.com/page", "http://localhost:3000"),
      ).resolves.toBe(false);
      expect(fetchSpy).toHaveBeenCalled();
    });

    it("should accept URLs with an image Content-Type", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockFetchResponse(200, "image/png")));
      await expect(validateImageURL("https://example.com/a.png")).resolves.toBe(true);
    });

    it("should reject URLs that definitively serve non-image content", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockFetchResponse(200, "text/html")));
      await expect(validateImageURL("https://example.com/page")).resolves.toBe(false);
    });

    it("should reject URLs that return 404", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockFetchResponse(404)));
      await expect(validateImageURL("https://example.com/missing.png")).resolves.toBe(false);
    });

    it("should fail open on network errors", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
      await expect(validateImageURL("https://example.com/a.png")).resolves.toBe(true);
    });

    it("should fail open on auth/bot blocks (403)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockFetchResponse(403)));
      await expect(validateImageURL("https://example.com/a.png")).resolves.toBe(true);
    });

    it("should fall back to a ranged GET when HEAD is not supported", async () => {
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(mockFetchResponse(405))
        .mockResolvedValueOnce(mockFetchResponse(200, "image/jpeg"));
      vi.stubGlobal("fetch", fetchSpy);

      await expect(validateImageURL("https://example.com/a.jpg")).resolves.toBe(true);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[0][1].method).toBe("HEAD");
      expect(fetchSpy.mock.calls[1][1].method).toBe("GET");
      expect(fetchSpy.mock.calls[1][1].headers.Range).toBe("bytes=0-0");
    });
  });
});
