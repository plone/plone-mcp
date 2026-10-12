import { z } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  ElicitResultSchema,
  ServerRequest,
  ServerNotification,
} from "@modelcontextprotocol/sdk/types.js";
import { PloneClient } from "../plone-client.js";
import { sessionManager } from "../session-manager.js";
import { wrapError } from "../utils/block-utils.js";
import {
  decodeSitemap,
  ParsedSitemap,
  parseSitemap,
  SitemapUrlEntry,
} from "../sitemap-parser.js";

// Tried in order when no sitemap_url is given: Plone's built-in sitemap,
// then the locations Volto and other generators use
const DEFAULT_SITEMAPS = ["/sitemap.xml.gz", "/sitemap-index.xml", "/sitemap.xml"];
const DEFAULT_MAX_ITEMS = 500;
const SITEMAP_ACCEPT = "application/xml, text/xml, application/x-gzip, */*";
// Upper bound on sitemap files fetched when following sitemap indexes
const MAX_SITEMAPS = 50;
const MAX_DUPLICATES_LISTED = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const inputSchema = z.object({
  sitemap_url: z
    .string()
    .optional()
    .describe(
      "Sitemap location: a path relative to the site root or an absolute URL on the same host as the configured site. When omitted, tries '/sitemap.xml.gz' (Plone's built-in sitemap, enabled in Site Setup → Site → 'Expose sitemap.xml.gz'), then '/sitemap-index.xml' and '/sitemap.xml', and asks the user if none is found (when the client supports elicitation). Sitemap indexes are followed automatically.",
    ),
  path: z
    .string()
    .optional()
    .describe("Only include URLs under this path, relative to the site root (e.g. '/news')"),
  modified_after: z
    .string()
    .optional()
    .describe("Only include URLs whose lastmod is on or after this ISO date (e.g. '2024-01-01')"),
  modified_before: z
    .string()
    .optional()
    .describe("Only include URLs whose lastmod is before this ISO date (e.g. '2023-01-01')"),
  stale_days: z
    .number()
    .int()
    .positive()
    .optional()
    .default(365)
    .describe("Age in days after which a URL's lastmod counts as stale in the stats"),
  include_stats: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include aggregate statistics (URLs per section, depth and lastmod year, oldest/newest, stale and duplicate URLs)"),
  max_items: z
    .number()
    .int()
    .positive()
    .optional()
    .default(DEFAULT_MAX_ITEMS)
    .describe("Maximum number of items returned; stats always cover every matching URL. Narrow with path or date filters rather than raising this on large sites"),
});

interface SitemapItem extends SitemapUrlEntry {
  path: string;
  depth: number;
  section: string;
}

function toSitePath(loc: string, baseUrl: string): string {
  let path: string;
  if (loc === baseUrl || loc.startsWith(`${baseUrl}/`)) {
    path = loc.slice(baseUrl.length);
  } else {
    try {
      path = new URL(loc).pathname;
    } catch {
      path = loc;
    }
  }
  path = path.replace(/[?#].*$/, "").replace(/\/+$/, "");
  return path.startsWith("/") ? path : `/${path}`;
}

function toItem(entry: SitemapUrlEntry, baseUrl: string): SitemapItem {
  const path = toSitePath(entry.loc, baseUrl);
  const segments = path.split("/").filter(Boolean);
  return {
    ...entry,
    path,
    depth: segments.length,
    section: segments[0] ?? "/",
  };
}

function parseDate(value: string, name: string): number {
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    throw new Error(`${name} is not a valid date: ${value}`);
  }
  return time;
}

function countBy(values: string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries(
    [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );
}

function buildStats(items: SitemapItem[], staleDays: number, now: number) {
  const dated = items
    .map((item) => ({ item, time: item.lastmod ? Date.parse(item.lastmod) : NaN }))
    .filter(({ time }) => !Number.isNaN(time))
    .sort((a, b) => a.time - b.time);
  const staleBefore = now - staleDays * DAY_MS;

  const locCounts = countBy(items.map((item) => item.loc));
  const duplicates = Object.entries(locCounts)
    .filter(([, count]) => count > 1)
    .map(([loc]) => loc);

  return {
    total_urls: items.length,
    by_section: countBy(items.map((item) => item.section)),
    by_depth: countBy(items.map((item) => String(item.depth))),
    by_lastmod_year: countBy(
      dated.map(({ time }) => String(new Date(time).getUTCFullYear())),
    ),
    missing_lastmod: items.length - dated.length,
    oldest: dated[0]
      ? { url: dated[0].item.loc, lastmod: dated[0].item.lastmod }
      : null,
    newest: dated.length
      ? { url: dated[dated.length - 1].item.loc, lastmod: dated[dated.length - 1].item.lastmod }
      : null,
    stale_days: staleDays,
    stale_count: dated.filter(({ time }) => time < staleBefore).length,
    duplicate_count: duplicates.length,
    duplicate_urls: duplicates.slice(0, MAX_DUPLICATES_LISTED),
  };
}

function describeError(error: unknown): string {
  const status =
    typeof error === "object" && error !== null
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;
  if (status !== undefined) return `HTTP ${status}`;
  return error instanceof Error ? error.message : String(error);
}

async function fetchSitemap(
  client: PloneClient,
  url: string,
): Promise<ParsedSitemap> {
  return parseSitemap(decodeSitemap(await client.getRaw(url, SITEMAP_ACCEPT)));
}

/**
 * Ask the user for the sitemap location via MCP elicitation. Returns
 * undefined when the user declines or the client cannot elicit.
 */
async function askSitemapUrl(
  client: PloneClient,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  tried: string[],
): Promise<string | undefined> {
  try {
    const result = await extra.sendRequest(
      {
        method: "elicitation/create",
        params: {
          mode: "form",
          message: `No sitemap found for ${client.baseUrl} (tried ${tried.join(", ")}). Where is it? It is often listed in /robots.txt.`,
          requestedSchema: {
            type: "object",
            properties: {
              sitemap_url: {
                type: "string",
                title: "Sitemap URL",
                description:
                  "Path relative to the site root or a URL on the same host",
              },
            },
          },
        },
      },
      ElicitResultSchema,
    );
    const value =
      result.action === "accept" ? result.content?.sitemap_url : undefined;
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

async function fetchFirstSitemap(
  client: PloneClient,
  sitemapUrl: string | undefined,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
): Promise<{ url: string; parsed: ParsedSitemap }> {
  const failures: string[] = [];
  const tryCandidate = async (candidate: string) => {
    const url = client.resolveSiteUrl(candidate);
    try {
      return { url, parsed: await fetchSitemap(client, url) };
    } catch (error) {
      failures.push(`${url} (${describeError(error)})`);
      return undefined;
    }
  };

  if (sitemapUrl !== undefined) {
    const found = await tryCandidate(sitemapUrl);
    if (found) return found;
  } else {
    for (const candidate of DEFAULT_SITEMAPS) {
      const found = await tryCandidate(candidate);
      if (found) return found;
    }
    const tried = DEFAULT_SITEMAPS.map((c) => client.resolveSiteUrl(c));
    const asked = await askSitemapUrl(client, extra, tried);
    if (asked !== undefined) {
      const found = await tryCandidate(asked);
      if (found) return found;
    }
  }

  throw new Error(
    `No sitemap found. Tried: ${failures.join(", ")}. Enable Plone's sitemap in Site Setup → Site → 'Expose sitemap.xml.gz', or pass sitemap_url.`,
  );
}

export const ploneGetSitemap = {
  config: {
    name: "plone_get_sitemap",
    description:
      "Lists ALL pages/content of the website (full site inventory) from its XML sitemap, with statistics for content audits: pages per section and depth, last-modified by year, oldest/newest, stale and duplicate pages. Use this — not plone_search or plone_get_navigation_tree — when asked to list, count or analyse all content of the site. Covers publicly visible content. Example: plone_get_sitemap({}) or plone_get_sitemap({path: '/news', modified_before: '2024-01-01'})",
    inputSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
  },
  handler: async (
    args: z.infer<typeof inputSchema>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    const sessionId = extra.sessionId || "default";
    const service = sessionManager.getSession(sessionId);

    try {
      const client = service.getClient();
      const {
        sitemap_url,
        path,
        modified_after,
        modified_before,
        stale_days,
        include_stats,
        max_items,
      } = args;

      const after =
        modified_after !== undefined
          ? parseDate(modified_after, "modified_after")
          : undefined;
      const before =
        modified_before !== undefined
          ? parseDate(modified_before, "modified_before")
          : undefined;
      const pathFilter =
        typeof path === "string" ? client.normalizePath(path) : "";

      const { url: startUrl, parsed: first } = await fetchFirstSitemap(
        client,
        sitemap_url,
        extra,
      );
      const queue = [startUrl];
      const seen = new Set<string>();
      const sitemaps: { url: string; type: string; count: number }[] = [];
      const skipped: { url: string; reason: string }[] = [];
      const entries: SitemapUrlEntry[] = [];

      while (queue.length > 0) {
        const url = queue.shift() as string;
        if (seen.has(url)) continue;
        if (seen.size >= MAX_SITEMAPS) {
          skipped.push({ url, reason: `limit of ${MAX_SITEMAPS} sitemaps reached` });
          continue;
        }
        seen.add(url);

        let parsed = first;
        if (url !== startUrl) {
          try {
            parsed = await fetchSitemap(client, url);
          } catch (error) {
            skipped.push({ url, reason: describeError(error) });
            continue;
          }
        }

        if (parsed.type === "sitemapindex") {
          sitemaps.push({ url, type: parsed.type, count: parsed.sitemaps.length });
          for (const child of parsed.sitemaps) {
            try {
              queue.push(client.resolveSiteUrl(child.loc));
            } catch (error) {
              skipped.push({
                url: child.loc,
                reason: error instanceof Error ? error.message : String(error),
              });
            }
          }
        } else {
          sitemaps.push({ url, type: parsed.type, count: parsed.urls.length });
          entries.push(...parsed.urls);
        }
      }

      const items = entries
        .map((entry) => toItem(entry, client.baseUrl))
        .filter((item) => {
          if (
            pathFilter &&
            item.path !== pathFilter &&
            !item.path.startsWith(`${pathFilter}/`)
          ) {
            return false;
          }
          if (after === undefined && before === undefined) return true;
          const time = item.lastmod ? Date.parse(item.lastmod) : NaN;
          if (Number.isNaN(time)) return false;
          return (
            (after === undefined || time >= after) &&
            (before === undefined || time < before)
          );
        });

      const limit = max_items ?? DEFAULT_MAX_ITEMS;
      const returned = items.slice(0, limit);
      const summary = {
        sitemap_url: startUrl,
        sitemaps,
        ...(skipped.length > 0 && { skipped_sitemaps: skipped }),
        total: items.length,
        returned: returned.length,
        truncated: items.length > returned.length,
        ...(include_stats !== false && {
          stats: buildStats(items, stale_days ?? 365, Date.now()),
        }),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ...summary, items: returned }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw wrapError("GetSitemap", error);
    }
  },
};
