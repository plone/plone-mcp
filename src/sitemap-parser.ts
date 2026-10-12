import { gunzipSync } from "node:zlib";

/**
 * Parser for the sitemaps.org protocol (urlset and sitemapindex).
 */

const MAX_SITEMAP_BYTES = 50 * 1024 * 1024;

interface XmlElement {
  name: string;
  children: XmlElement[];
  text: string;
}

export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export interface SitemapIndexEntry {
  loc: string;
  lastmod?: string;
}

export type ParsedSitemap =
  | { type: "urlset"; urls: SitemapUrlEntry[] }
  | { type: "sitemapindex"; sitemaps: SitemapIndexEntry[] };

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const code =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[entity] ?? match;
  });
}

const TOKEN_RE =
  /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)(?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*\s*(\/?)>|([^<]+)/gi;

function parseXml(xml: string): XmlElement {
  const root: XmlElement = { name: "#document", children: [], text: "" };
  const stack = [root];

  for (const m of xml.matchAll(TOKEN_RE)) {
    const current = stack[stack.length - 1];
    const [, cdata, closeName, openName, selfClosing, text] = m;
    if (cdata !== undefined) {
      current.text += cdata;
    } else if (closeName !== undefined) {
      if (stack.length < 2 || current.name !== closeName) {
        throw new Error(`Malformed XML: unexpected </${closeName}>`);
      }
      stack.pop();
    } else if (openName !== undefined) {
      const element: XmlElement = { name: openName, children: [], text: "" };
      current.children.push(element);
      if (!selfClosing) stack.push(element);
    } else if (text !== undefined) {
      current.text += decodeEntities(text);
    }
  }

  if (stack.length !== 1) {
    throw new Error(`Malformed XML: unclosed <${stack[stack.length - 1].name}>`);
  }
  return root;
}

function localName(name: string): string {
  return name.slice(name.indexOf(":") + 1);
}

function childText(element: XmlElement, name: string): string | undefined {
  const child = element.children.find((c) => localName(c.name) === name);
  const text = child?.text.trim();
  return text ? text : undefined;
}

function parseUrlEntry(element: XmlElement): SitemapUrlEntry | null {
  const loc = childText(element, "loc");
  if (!loc) return null;

  const entry: SitemapUrlEntry = { loc };
  const lastmod = childText(element, "lastmod");
  const changefreq = childText(element, "changefreq");
  const priority = parseFloat(childText(element, "priority") ?? "");
  if (lastmod) entry.lastmod = lastmod;
  if (changefreq) entry.changefreq = changefreq;
  if (Number.isFinite(priority)) entry.priority = priority;
  return entry;
}

/**
 * Decode raw sitemap bytes, transparently gunzipping .xml.gz content.
 */
export function decodeSitemap(raw: Buffer): string {
  const isGzip = raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b;
  const bytes = isGzip
    ? gunzipSync(raw, { maxOutputLength: MAX_SITEMAP_BYTES })
    : raw;
  return bytes.toString("utf8");
}

export function parseSitemap(xml: string): ParsedSitemap {
  const root = parseXml(xml).children[0];
  const rootName = root ? localName(root.name) : undefined;

  if (rootName === "urlset") {
    return {
      type: "urlset",
      urls: root.children
        .filter((c) => localName(c.name) === "url")
        .map(parseUrlEntry)
        .filter((entry): entry is SitemapUrlEntry => entry !== null),
    };
  }

  if (rootName === "sitemapindex") {
    const sitemaps: SitemapIndexEntry[] = [];
    for (const child of root.children) {
      if (localName(child.name) !== "sitemap") continue;
      const loc = childText(child, "loc");
      if (!loc) continue;
      const lastmod = childText(child, "lastmod");
      sitemaps.push(lastmod ? { loc, lastmod } : { loc });
    }
    return { type: "sitemapindex", sitemaps };
  }

  throw new Error(
    `Not a sitemap: expected <urlset> or <sitemapindex>, got ${rootName ? `<${rootName}>` : "no root element"}`,
  );
}
