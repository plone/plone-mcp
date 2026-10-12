import { gzipSync } from "node:zlib";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneGetSitemap } from "plone-mcp/tools/plone_get_sitemap";
import { PloneClient } from "plone-mcp/plone-client";
import { sessionManager } from "plone-mcp/session-manager";

const urlset = (urls: string) =>
  `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`;

describe("plone_get_sitemap", () => {
  const host = "http://localhost:8080";
  const testBaseUrl = `${host}/Plone`;
  const sessionId = "test-session-id";
  const mockExtra = {
    sessionId,
    signal: new AbortController().signal,
    requestId: "test-request-id",
  } as any;

  const run = (args: Record<string, unknown> = {}) =>
    ploneGetSitemap.handler(args as any, mockExtra);

  beforeEach(() => {
    const service = sessionManager.getSession(sessionId);
    service.client = new PloneClient({ baseUrl: testBaseUrl });
  });

  afterEach(() => {
    Nock.cleanAll();
    sessionManager.clearSession(sessionId);
  });

  it("fetches the gzipped sitemap outside ++api++ and returns items with stats", async () => {
    const recent = new Date().toISOString();
    Nock(host)
      .get("/Plone/sitemap.xml.gz")
      .matchHeader("accept", (value) => !value.includes("application/json"))
      .reply(
        200,
        gzipSync(
          urlset(`
            <url><loc>${testBaseUrl}</loc><lastmod>${recent}</lastmod></url>
            <url><loc>${testBaseUrl}/news/item-1</loc><lastmod>2019-03-01</lastmod><changefreq>weekly</changefreq>
              <xhtml:link rel="alternate" hreflang="de" href="${testBaseUrl}/de/item-1"/></url>
            <url><loc>${testBaseUrl}/news</loc><lastmod>2020-06-01</lastmod></url>
            <url><loc>${testBaseUrl}/news</loc></url>`),
        ),
      );

    const result = await run();
    const data = JSON.parse(result.content[0].text);

    expect(Nock.isDone()).toBe(true);
    expect(data.sitemap_url).toBe(`${testBaseUrl}/sitemap.xml.gz`);
    expect(data.total).toBe(4);
    expect(data.truncated).toBe(false);
    expect(data.items[1]).toEqual({
      loc: `${testBaseUrl}/news/item-1`,
      lastmod: "2019-03-01",
      changefreq: "weekly",
      path: "/news/item-1",
      depth: 2,
      section: "news",
    });
    expect(Object.keys(data.stats).sort()).toEqual([
      "by_depth",
      "by_lastmod_year",
      "by_section",
      "duplicate_count",
      "duplicate_urls",
      "missing_lastmod",
      "newest",
      "oldest",
      "stale_count",
      "stale_days",
      "total_urls",
    ]);
    expect(data.stats).toMatchObject({
      total_urls: 4,
      by_section: { news: 3, "/": 1 },
      by_depth: { "0": 1, "1": 2, "2": 1 },
      by_lastmod_year: { "2019": 1, "2020": 1 },
      missing_lastmod: 1,
      oldest: { url: `${testBaseUrl}/news/item-1`, lastmod: "2019-03-01" },
      newest: { url: testBaseUrl, lastmod: recent },
      stale_count: 2,
      duplicate_urls: [`${testBaseUrl}/news`],
    });
  });

  it("follows sitemap indexes and skips other hosts", async () => {
    Nock(host)
      .get("/Plone/sitemap-index.xml")
      .reply(
        200,
        `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>${testBaseUrl}/sitemap1.xml</loc></sitemap>
          <sitemap><loc>https://evil.example.com/sitemap2.xml</loc></sitemap>
        </sitemapindex>`,
      )
      .get("/Plone/sitemap1.xml")
      .reply(200, urlset(`<url><loc>${testBaseUrl}/a</loc></url>`));

    const data = JSON.parse(
      (await run({ sitemap_url: "/sitemap-index.xml" })).content[0].text,
    );

    expect(Nock.isDone()).toBe(true);
    expect(data.sitemaps).toEqual([
      { url: `${testBaseUrl}/sitemap-index.xml`, type: "sitemapindex", count: 2 },
      { url: `${testBaseUrl}/sitemap1.xml`, type: "urlset", count: 1 },
    ]);
    expect(data.skipped_sitemaps).toHaveLength(1);
    expect(data.skipped_sitemaps[0].url).toBe(
      "https://evil.example.com/sitemap2.xml",
    );
    expect(data.items.map((i: any) => i.path)).toEqual(["/a"]);
  });

  it("filters by path and lastmod and truncates to max_items", async () => {
    Nock(host)
      .get("/Plone/sitemap.xml.gz")
      .reply(
        200,
        urlset(`
          <url><loc>${testBaseUrl}/news/a</loc><lastmod>2020-01-01</lastmod></url>
          <url><loc>${testBaseUrl}/news/b</loc><lastmod>2021-01-01</lastmod></url>
          <url><loc>${testBaseUrl}/news/c</loc><lastmod>2022-01-01</lastmod></url>
          <url><loc>${testBaseUrl}/newsletter</loc><lastmod>2020-01-01</lastmod></url>
          <url><loc>${testBaseUrl}/news/d</loc></url>`),
      );

    const data = JSON.parse(
      (
        await run({
          path: "/news",
          modified_before: "2022-01-01",
          max_items: 1,
          include_stats: false,
        })
      ).content[0].text,
    );

    expect(data.total).toBe(2);
    expect(data.returned).toBe(1);
    expect(data.truncated).toBe(true);
    expect(data.stats).toBeUndefined();
    expect(data.items[0].path).toBe("/news/a");
  });

  it("falls back to other sitemap locations when sitemap.xml.gz is unavailable", async () => {
    Nock(host)
      .get("/Plone/sitemap.xml.gz")
      .replyWithError({ code: "ECONNABORTED", message: "timeout of 30000ms exceeded" })
      .get("/Plone/sitemap-index.xml")
      .reply(404, "Not Found")
      .get("/Plone/sitemap.xml")
      .reply(200, urlset(`<url><loc>${testBaseUrl}/a</loc></url>`));

    const data = JSON.parse((await run()).content[0].text);

    expect(Nock.isDone()).toBe(true);
    expect(data.sitemap_url).toBe(`${testBaseUrl}/sitemap.xml`);
    expect(data.total).toBe(1);
  });

  it("lists every location tried when no sitemap is found", async () => {
    Nock(host)
      .get("/Plone/sitemap.xml.gz")
      .reply(404, "Not Found")
      .get("/Plone/sitemap-index.xml")
      .reply(404, "Not Found")
      .get("/Plone/sitemap.xml")
      .reply(200, "<html><body>Not a sitemap</body></html>");

    const error = await run().catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(
      `${testBaseUrl}/sitemap.xml.gz (HTTP 404), ${testBaseUrl}/sitemap-index.xml (HTTP 404), ${testBaseUrl}/sitemap.xml (Not a sitemap`,
    );
    expect((error as Error).message).toContain("Expose sitemap.xml.gz");
  });

  it("does not fall back when sitemap_url is given", async () => {
    Nock(host).get("/Plone/custom.xml").reply(404, "Not Found");

    await expect(run({ sitemap_url: "/custom.xml" })).rejects.toThrow(
      `Tried: ${testBaseUrl}/custom.xml (HTTP 404).`,
    );
    expect(Nock.isDone()).toBe(true);
  });

  describe("asking the user for the sitemap URL", () => {
    const withElicitation = (
      sendRequest: (...args: any[]) => Promise<unknown>,
    ) => ({ ...mockExtra, sendRequest: vi.fn(sendRequest) });

    const defaultsNotFound = () =>
      Nock(host)
        .get("/Plone/sitemap.xml.gz")
        .reply(404, "Not Found")
        .get("/Plone/sitemap-index.xml")
        .reply(404, "Not Found")
        .get("/Plone/sitemap.xml")
        .reply(404, "Not Found");

    it("does not ask when a default location has a sitemap", async () => {
      const extra = withElicitation(async () => ({ action: "decline" }));
      Nock(host)
        .get("/Plone/sitemap.xml.gz")
        .reply(200, urlset(`<url><loc>${testBaseUrl}/a</loc></url>`));

      const result = await ploneGetSitemap.handler({} as any, extra);

      expect(JSON.parse(result.content[0].text).total).toBe(1);
      expect(extra.sendRequest).not.toHaveBeenCalled();
    });

    it("asks after the default locations fail and fetches the entered URL", async () => {
      const extra = withElicitation(async () => ({
        action: "accept",
        content: { sitemap_url: " /my-sitemap.xml " },
      }));
      defaultsNotFound()
        .get("/Plone/my-sitemap.xml")
        .reply(200, urlset(`<url><loc>${testBaseUrl}/a</loc></url>`));

      const result = await ploneGetSitemap.handler({} as any, extra);

      expect(Nock.isDone()).toBe(true);
      expect(JSON.parse(result.content[0].text).sitemap_url).toBe(
        `${testBaseUrl}/my-sitemap.xml`,
      );
      const [request] = extra.sendRequest.mock.calls[0];
      expect(request.method).toBe("elicitation/create");
      expect(request.params.message).toContain(
        `tried ${testBaseUrl}/sitemap.xml.gz, ${testBaseUrl}/sitemap-index.xml, ${testBaseUrl}/sitemap.xml`,
      );
    });

    it("reports every attempt when the entered URL also fails", async () => {
      const extra = withElicitation(async () => ({
        action: "accept",
        content: { sitemap_url: "/missing.xml" },
      }));
      defaultsNotFound().get("/Plone/missing.xml").reply(404, "Not Found");

      await expect(ploneGetSitemap.handler({} as any, extra)).rejects.toThrow(
        `${testBaseUrl}/sitemap.xml (HTTP 404), ${testBaseUrl}/missing.xml (HTTP 404).`,
      );
      expect(Nock.isDone()).toBe(true);
    });

    it.each([
      ["declines", async () => ({ action: "decline" })],
      ["cancels", async () => ({ action: "cancel" })],
      ["accepts an empty value", async () => ({ action: "accept", content: { sitemap_url: "" } })],
      ["cannot elicit", async () => Promise.reject(new Error("Method not found"))],
    ])("fails with the attempted locations when the user %s", async (_, reply) => {
      defaultsNotFound();

      await expect(
        ploneGetSitemap.handler({} as any, withElicitation(reply)),
      ).rejects.toThrow("No sitemap found. Tried:");
      expect(Nock.isDone()).toBe(true);
    });

    it("does not ask when the given sitemap_url fails", async () => {
      const extra = withElicitation(async () => ({ action: "decline" }));
      Nock(host).get("/Plone/custom.xml").reply(404, "Not Found");

      await expect(
        ploneGetSitemap.handler({ sitemap_url: "/custom.xml" } as any, extra),
      ).rejects.toThrow("No sitemap found");
      expect(extra.sendRequest).not.toHaveBeenCalled();
    });
  });

  it("rejects sitemap URLs on other hosts", async () => {
    await expect(
      run({ sitemap_url: "https://evil.example.com/sitemap.xml" }),
    ).rejects.toThrow("not on the configured site's host");
  });

  it("rejects invalid dates", async () => {
    await expect(run({ modified_after: "yesterday" })).rejects.toThrow(
      "modified_after is not a valid date",
    );
  });
});
