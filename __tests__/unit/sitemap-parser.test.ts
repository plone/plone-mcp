import { gzipSync } from "node:zlib";
import { describe, it, expect } from "vitest";
import { decodeSitemap, parseSitemap } from "plone-mcp/sitemap-parser";

const urlset = `<?xml version="1.0" encoding="UTF-8"?>
<!-- generated -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://example.com/news?a=1&amp;b=2</loc>
    <lastmod>2024-05-01T10:00:00Z</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="de" href="https://example.com/de/news"/>
  </url>
  <url><loc><![CDATA[https://example.com/about]]></loc></url>
  <url><lastmod>2024-01-01</lastmod></url>
</urlset>`;

describe("sitemap-parser", () => {
  it("parses the protocol fields of urlset entries and ignores extensions", () => {
    const parsed = parseSitemap(urlset);
    expect(parsed.type).toBe("urlset");
    if (parsed.type !== "urlset") return;

    expect(parsed.urls).toHaveLength(2);
    expect(parsed.urls[0]).toEqual({
      loc: "https://example.com/news?a=1&b=2",
      lastmod: "2024-05-01T10:00:00Z",
      changefreq: "daily",
      priority: 0.8,
    });
    expect(parsed.urls[1]).toEqual({ loc: "https://example.com/about" });
  });

  it("parses a sitemap index", () => {
    const parsed = parseSitemap(
      `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/s1.xml</loc><lastmod>2024-01-01</lastmod></sitemap>
        <sitemap><loc>https://example.com/s2.xml</loc></sitemap>
      </sitemapindex>`,
    );
    expect(parsed).toEqual({
      type: "sitemapindex",
      sitemaps: [
        { loc: "https://example.com/s1.xml", lastmod: "2024-01-01" },
        { loc: "https://example.com/s2.xml" },
      ],
    });
  });

  it("rejects documents that are not sitemaps", () => {
    expect(() => parseSitemap("<html><body></body></html>")).toThrow(
      "Not a sitemap",
    );
  });

  it("rejects malformed XML", () => {
    expect(() => parseSitemap("<urlset><url></urlset>")).toThrow(
      "Malformed XML",
    );
    expect(() => parseSitemap("<urlset><url>")).toThrow("Malformed XML");
  });

  it("decodes gzipped and plain sitemaps", () => {
    const xml = "<urlset></urlset>";
    expect(decodeSitemap(gzipSync(xml))).toBe(xml);
    expect(decodeSitemap(Buffer.from(xml))).toBe(xml);
  });
});
