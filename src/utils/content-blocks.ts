import { z } from "zod";
import { blockRegistry } from "../block-registry.js";
import {
  generateBlockId,
  processBlock,
  validateImageURL,
} from "./block-utils.js";

export const blockSpecsSchema = z
  .array(
    z.object({
      type: z
        .enum(blockRegistry.getBlockTypesEnum())
        .describe("Type of block to create"),
      data: z
        .record(z.string(), z.unknown())
        .describe("Block-specific data following the block specification"),
    }),
  )
  .describe(
    "Array of block specifications, converted to Volto blocks by the server in the same call. You MUST call plone_get_block_schemas first to see available block types and their required fields. You MUST follow the block specifications EXACTLY, DO NOT invent your own fields. DO NOT add the content object's title in a text block: set it with the 'title' argument instead, a Title block is created automatically.",
  );

export type BlockSpecs = z.infer<typeof blockSpecsSchema>;

export interface ContentBlocks {
  blocks: Record<string, unknown>;
  blocks_layout: { items: string[] };
}

/**
 * Converts block specifications into Volto blocks and their layout, in order.
 * Image URLs are checked first, so nothing is converted if one is invalid.
 * Errors name the offending spec by index and type.
 */
export async function buildBlocksFromSpecs(
  specs: BlockSpecs,
  baseUrl?: string,
): Promise<ContentBlocks> {
  const validImages = await Promise.all(
    specs.map((spec) =>
      spec.type === "image" &&
      typeof spec.data.url === "string" &&
      spec.data.url
        ? validateImageURL(spec.data.url, baseUrl)
        : true,
    ),
  );

  const blocks: Record<string, unknown> = {};
  const items: string[] = [];

  specs.forEach((spec, index) => {
    const label = `block_specs[${index}] (${spec.type})`;
    if (!validImages[index]) {
      throw new Error(
        `${label}: Invalid or inaccessible image URL: ${spec.data.url}`,
      );
    }

    let block: Record<string, unknown>;
    try {
      block = processBlock(spec.type, spec.data, baseUrl);
    } catch (error) {
      throw new Error(
        `${label}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const blockId = generateBlockId();
    blocks[blockId] = block;
    items.push(blockId);
  });

  return { blocks, blocks_layout: { items } };
}

/**
 * Builds the final blocks and layout for a create or update operation.
 * Raw `blocks` / `blocks_layout` are processed here; `built` comes from
 * buildBlocksFromSpecs and is used as is. A title block always exists and is
 * the first item in the layout.
 * @returns The final blocks and layout, or null for an update without block changes.
 */
export function processBlocksForContent({
  blocks,
  blocks_layout,
  built,
  isUpdate = false,
  baseUrl,
}: {
  blocks?: Record<string, unknown>;
  blocks_layout?: Record<string, unknown>;
  built?: ContentBlocks;
  isUpdate?: boolean;
  baseUrl?: string;
}): ContentBlocks | null {
  const hasProvidedBlocks = Boolean(blocks || blocks_layout);

  // For updates without blocks, do nothing. For creates, a default title
  // block is added below.
  if (!hasProvidedBlocks && !built && isUpdate) {
    return null;
  }

  let finalBlocks: Record<string, unknown> = {};
  let finalLayout: string[] = [];

  if (hasProvidedBlocks) {
    const rawBlocks = blocks || {};
    const layoutItems = (blocks_layout as { items?: string[] } | undefined)
      ?.items;
    const requestedLayout = layoutItems
      ? [...layoutItems]
      : Object.keys(rawBlocks);

    // Keep only layout ids that reference an actual block, then append any
    // blocks that were omitted from the layout so nothing is silently lost.
    finalLayout = requestedLayout.filter((id) => rawBlocks[id]);
    for (const id of Object.keys(rawBlocks)) {
      if (!finalLayout.includes(id)) {
        finalLayout.push(id);
      }
    }

    for (const id of finalLayout) {
      const blockData = rawBlocks[id] as Record<string, unknown>;
      const blockType = (blockData["@type"] as string) || "text";
      finalBlocks[id] = processBlock(blockType, blockData, baseUrl);
    }
  } else if (built) {
    finalBlocks = { ...built.blocks };
    finalLayout = [...built.blocks_layout.items];
  }

  let titleBlockId = finalLayout.find(
    (id: string) =>
      (finalBlocks[id] as { "@type"?: string })?.["@type"] === "title",
  );

  if (!titleBlockId) {
    titleBlockId = generateBlockId();
    finalLayout.unshift(titleBlockId);
  } else if (finalLayout[0] !== titleBlockId) {
    finalLayout = finalLayout.filter((id: string) => id !== titleBlockId);
    finalLayout.unshift(titleBlockId);
  }

  // The title block only ever contains its @type
  finalBlocks[titleBlockId] = { "@type": "title" };

  return {
    blocks: finalBlocks,
    blocks_layout: { items: finalLayout },
  };
}
