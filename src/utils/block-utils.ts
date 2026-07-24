import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { markdownParse } from "../markdown-parser.js";

export interface BlockProcessingContext {
  processBlock: (
    type: string,
    data: Record<string, unknown>,
  ) => Record<string, unknown>;
  normalizeHref: (href: unknown, blockType: string) => { "@id": string }[];
  generateBlockId: () => string;
  wrapError: (operation: string, error: unknown) => Error;
}

export type BlockProcessor = (
  blockData: Record<string, unknown>,
  context: BlockProcessingContext,
) => Record<string, unknown>;

export function wrapError(operation: string, error: unknown): Error {
  if (error instanceof z.ZodError) {
    return new Error(`[${operation}] Invalid parameters: ${error.message}`);
  }
  return new Error(
    `[${operation}] ${error instanceof Error ? error.message : String(error)}`,
  );
}

export function generateBlockId(): string {
  return uuidv4();
}


export function normalizeUrl(url: string, baseUrl?: string): string {
  if (baseUrl && url.startsWith("/") && !url.startsWith("//")) {
    return `${baseUrl}${url}`;
  }
  return url;
}

/**
 * Normalize href values to the required array format and convert relative URLs to absolute
 */
export function normalizeHref(
  href: unknown,
  blockType: string,
  baseUrl?: string,
): { "@id": string }[] {
  if (typeof href === "string") {
    return [{ "@id": normalizeUrl(href, baseUrl) }];
  }

  if (Array.isArray(href)) {
    if (href.length === 0) {
      throw wrapError(
        "ProcessBlock",
        `href cannot be empty for ${blockType} block`,
      );
    }

    const firstItem = href[0] as Record<string, unknown> | undefined;
    if (firstItem?.["@id"] && typeof firstItem["@id"] === "string") {
      return [
        {
          ...firstItem,
          "@id": normalizeUrl(firstItem["@id"], baseUrl),
        } as { "@id": string },
      ];
    }

    return href as { "@id": string }[];
  }

  throw wrapError(
    "ProcessBlock",
    `Invalid href format for ${blockType} block. Expected string or array, got: ${typeof href}`,
  );
}

const IMAGE_VALIDATION_TIMEOUT_MS = 5000;

async function fetchImageProbe(
  url: string,
  method: "HEAD" | "GET",
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    IMAGE_VALIDATION_TIMEOUT_MS,
  );
  try {
    return await fetch(url, {
      method,
      headers: {
        Accept: "image/*",
        // Only probe the first byte when we have to fall back to GET
        ...(method === "GET" ? { Range: "bytes=0-0" } : {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Validate that a URL plausibly points to an image, to avoid creating blank
 * image blocks.
 *
 * Internal references — relative paths, resolveuid/ links, and URLs on the
 * configured Plone site itself — are always accepted without probing: they
 * point at an Image *content object* (whose @id serves HTML, not image
 * bytes), and Plone resolves them server-side.
 */
export async function validateImageURL(
  url: string,
  baseUrl?: string,
): Promise<boolean> {
  // For data URLs, check MIME type
  if (url.startsWith("data:")) {
    return url.startsWith("data:image/");
  }

  // Internal content references are resolved by Plone itself
  if (url.startsWith("/") || url.startsWith("resolveuid/")) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // URLs on the configured site are trusted: the @id of an Image object
  // serves an HTML page, so a Content-Type probe would reject valid refs
  if (baseUrl) {
    try {
      if (parsed.origin === new URL(baseUrl).origin) {
        return true;
      }
    } catch {
      // Unparseable baseUrl - fall through to the external probe
    }
  }

  let response: Response;
  try {
    response = await fetchImageProbe(url, "HEAD");
    if (response.status === 405 || response.status === 501) {
      // Server does not support HEAD; retry with a ranged GET
      response = await fetchImageProbe(url, "GET");
    }
  } catch {
    // Unreachable from this process does not mean unreachable for Plone
    return true;
  }

  if (response.status === 404 || response.status === 410) {
    return false;
  }
  if (!response.ok) {
    return true;
  }

  const contentType = response.headers.get("Content-Type");
  if (!contentType) {
    return true;
  }
  return (
    contentType.startsWith("image/") ||
    contentType.startsWith("application/octet-stream")
  );
}

// =============================================================================
// Block Processors
// =============================================================================

/**
 * Process slate/text block
 */
function processSlateBlock(
  blockData: Record<string, unknown>,
  // _context: BlockProcessingContext,
): Record<string, unknown> {
  // Always set type to slate, but allow overriding by putting blockData first
  // Actually, we want to enforce @type: slate
  const baseData = { ...blockData, "@type": "slate" };

  // If 'text' is provided, always derive value from it.
  if (blockData.text !== undefined) {
    const textContent = (blockData.text as string) || "";
    return {
      ...baseData,
      plaintext: textContent,
      value: markdownParse(textContent),
    };
  }

  // If 'value' is already provided, trust it
  if (blockData.value !== undefined) {
    return baseData;
  }

  // If 'plaintext' is provided, derive value from it
  if (blockData.plaintext !== undefined) {
    const textContent = (blockData.plaintext as string) || "";
    return {
      ...baseData,
      value: markdownParse(textContent),
    };
  }

  return {
    ...baseData,
    plaintext: "",
    value: markdownParse(""),
  };
}

/**
 * Process image block
 */
function processImageBlock(
  blockData: Record<string, unknown>,
  context: BlockProcessingContext,
): Record<string, unknown> {
  if (
    !blockData?.url ||
    typeof blockData.url !== "string" ||
    !blockData.url.trim()
  ) {
    throw context.wrapError(
      "ProcessBlock",
      `Missing or invalid image URL: ${String(blockData?.url)}`,
    );
  }
  return { ...blockData, "@type": "image" };
}

/**
 * Process teaser block
 */
function processTeaserBlock(
  blockData: Record<string, unknown>,
  context: BlockProcessingContext,
): Record<string, unknown> {
  const processedData: Record<string, unknown> = {
    overwrite: false,
    ...blockData,
    "@type": "teaser",
  };

  if (blockData.href) {
    processedData.href = context.normalizeHref(blockData.href, "teaser");
  }

  return processedData;
}

/**
 * Process button block
 */
function processButtonBlock(
  blockData: Record<string, unknown>,
  context: BlockProcessingContext,
): Record<string, unknown> {
  const processedData: Record<string, unknown> = {
    ...blockData,
    "@type": "__button",
  };

  if (blockData.href) {
    processedData.href = context.normalizeHref(blockData.href, "__button");
  }

  return processedData;
}

/**
 * Process child blocks within a container (used by gridBlock, Accordion, etc.)
 */
function processChildBlocks(
  blocks: Record<string, unknown>,
  blockOrder: string[],
  parentBlockType: string,
  context: BlockProcessingContext,
): { blocks: Record<string, unknown>; blockIds: string[] } {
  const processedBlocks: Record<string, unknown> = {};
  const blockIds: string[] = [];

  // Process blocks in the order specified by blockOrder
  for (const originalBlockId of blockOrder) {
    const childBlockData = blocks[originalBlockId] as Record<string, unknown>;
    if (!childBlockData) {
      continue; // Skip if block doesn't exist
    }

    const childType = childBlockData["@type"] as string;

    if (!childType) {
      throw context.wrapError(
        "ProcessBlock",
        `${parentBlockType} child blocks must have an @type field`,
      );
    }

    const newBlockId = context.generateBlockId();
    processedBlocks[newBlockId] = context.processBlock(
      childType,
      childBlockData,
    );
    blockIds.push(newBlockId);
  }

  return { blocks: processedBlocks, blockIds };
}

/**
 * Process gridBlock
 */
function processGridBlock(
  blockData: Record<string, unknown>,
  context: BlockProcessingContext,
): Record<string, unknown> {
  const processedData: Record<string, unknown> = {
    ...blockData,
    "@type": "gridBlock",
  };

  if (!blockData.blocks || typeof blockData.blocks !== "object") {
    return processedData;
  }

  const innerBlocks = blockData.blocks as Record<string, unknown>;
  const blocksLayout = blockData.blocks_layout as
    | { items?: string[] }
    | undefined;

  // Get block order from blocks_layout if available, otherwise use object keys
  const blockOrder: string[] = blocksLayout?.items || Object.keys(innerBlocks);

  const { blocks, blockIds } = processChildBlocks(
    innerBlocks,
    blockOrder,
    "gridBlock",
    context,
  );
  processedData.blocks = blocks;
  processedData.blocks_layout = { items: blockIds };

  return processedData;
}

/**
 * Default processor for blocks without specific handlers
 */
export function processDefaultBlock(
  blockData: Record<string, unknown>,
  blockType: string,
): Record<string, unknown> {
  return { ...blockData, "@type": blockType };
}

/**
 * Registry mapping block types to their handlers
 */
const blockProcessors: Record<string, BlockProcessor> = {
  slate: processSlateBlock,
  text: processSlateBlock,
  image: processImageBlock,
  teaser: processTeaserBlock,
  __button: processButtonBlock,
  gridBlock: processGridBlock,
};

/**
 * Process a block using the registry and providing context
 */
export function processBlock(
  blockType: string,
  blockData: Record<string, unknown>,
  baseUrl?: string,
): Record<string, unknown> {
  const context: BlockProcessingContext = {
    processBlock: (type, data) => processBlock(type, data, baseUrl),
    normalizeHref: (href, type) => normalizeHref(href, type, baseUrl),
    generateBlockId,
    wrapError,
  };

  const processor = blockProcessors[blockType];
  if (processor) {
    return processor(blockData, context);
  }
  return processDefaultBlock(blockData, blockType);
}

/**
 * Get example block data for documentation
 */
export function getBlockExample(blockType: string): unknown {
  const examples: Record<string, unknown> = {
    teaser: {
      _usage:
        "In most cases pass ONLY href - the teaser automatically mirrors the target's title, description and image (the tool stores overwrite: false for you). Set overwrite: true ONLY when also providing custom values to replace the target's own.",
      default: {
        href: [
          {
            "@id": "https://example.com/news/latest-updates",
          },
        ],
      },
      withCustomValues: {
        href: [
          {
            "@id": "https://example.com/news/latest-updates",
          },
        ],
        overwrite: true,
        title: "Latest Company Updates",
        head_title: "News",
        description: "Read about our recent achievements and announcements",
        preview_image: [
          {
            "@id": "https://example.com/images/latest-updates-preview.jpg",
            image_field: "image",
          },
        ],
        theme: "default",
        styles: {
          align: "left",
        },
      },
    },
    slate: {
      text: "This is a paragraph of text content that will be converted to Slate format.",
      theme: "default",
    },
    __button: {
      href: [{ "@id": "https://example.com/contact", title: "Contact Page" }],
      title: "Contact Us",
      theme: "default",
      styles: {
        "align:noprefix": {
          "--block-alignment": "var(--align-center)",
        },
        "blockWidth:noprefix": {
          "--block-width": "var(--default-container-width)",
        },
      },
    },
    separator: {
      theme: "default",
      styles: {
        "align:noprefix": {
          "--block-alignment": "var(--align-left)",
        },
        "blockWidth:noprefix": {
          "--block-width": "var(--narrow-container-width)",
        },
        shortLine: true,
      },
    },
    image: {
      url: "https://example.com/images/logo.png",
      alt: "Logo",
    },
    gridBlock: {
      blocks: {
        "block-1": {
          "@type": "teaser",
          href: "https://example.com/teaser-1",
        },
        "block-2": {
          "@type": "image",
          url: "https://example.com/image.png",
        },
      },
      blocks_layout: {
        items: ["block-1", "block-2"],
      },
    },
    listing: {
      variation: "grid",
      querystring: {
        query: [
          {
            i: "portal_type",
            o: "plone.app.querystring.operation.selection.any",
            v: ["News Item"],
          },
        ],
        sort_on: "effective",
        sort_order: "descending",
      },
    },
  };

  return examples[blockType] || {};
}
