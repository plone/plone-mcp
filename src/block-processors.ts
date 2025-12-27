import { markdownParse } from "./markdown-parser.js";

export interface BlockProcessingContext {
  processBlock: (type: string, data: Record<string, any>) => Record<string, any>;
  normalizeHref: (href: any, blockType: string) => Array<{ "@id": string }>;
  generateBlockId: () => string;
  wrapError: (operation: string, error: unknown) => Error;
}

export type BlockProcessor = (
  blockData: Record<string, any>,
  context: BlockProcessingContext
) => Record<string, any>;

// =============================================================================
// Block Processors
// =============================================================================

/**
 * Process slate/text block
 */
function processSlateBlock(
  blockData: Record<string, any>,
  _context: BlockProcessingContext
): Record<string, any> {
  // If value already exists, preserve it (pre-parsed Slate format)
  if (blockData.value) {
    return { "@type": "slate", ...blockData };
  }

  // Parse text field into Slate format
  const textContent = blockData.text || "";
  return {
    "@type": "slate",
    plaintext: textContent,
    value: markdownParse(textContent),
    theme: blockData.theme || "default",
  };
}

/**
 * Process image block
 */
function processImageBlock(
  blockData: Record<string, any>,
  context: BlockProcessingContext
): Record<string, any> {
  if (
    !blockData?.url ||
    typeof blockData.url !== "string" ||
    !blockData.url.trim()
  ) {
    throw context.wrapError(
      "ProcessBlock",
      `Image blocks currently only support public image URLs. File attachments are not supported yet. Received: ${String(blockData?.url)}`

    );
  }
  return { ...blockData, "@type": "image" };
}

/**
 * Process teaser block
 */
function processTeaserBlock(
  blockData: Record<string, any>,
  context: BlockProcessingContext
): Record<string, any> {
  const processedData: Record<string, any> = {
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
  blockData: Record<string, any>,
  context: BlockProcessingContext
): Record<string, any> {
  const processedData: Record<string, any> = {
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
  blocks: Record<string, any>,
  blockOrder: string[],
  parentBlockType: string,
  context: BlockProcessingContext
): { blocks: Record<string, any>; blockIds: string[] } {
  const processedBlocks: Record<string, any> = {};
  const blockIds: string[] = [];

  // Process blocks in the order specified by blockOrder
  for (const originalBlockId of blockOrder) {
    const childBlockData = blocks[originalBlockId] as Record<string, any>;
    if (!childBlockData) {
      continue; // Skip if block doesn't exist
    }

    const childType = childBlockData["@type"];

    if (!childType) {
      throw context.wrapError(
        "ProcessBlock",
        `${parentBlockType} child blocks must have an @type field`
      );
    }

    const newBlockId = context.generateBlockId();
    processedBlocks[newBlockId] = context.processBlock(childType, childBlockData);
    blockIds.push(newBlockId);
  }

  return { blocks: processedBlocks, blockIds };
}

/**
 * Process gridBlock
 */
function processGridBlock(
  blockData: Record<string, any>,
  context: BlockProcessingContext
): Record<string, any> {
  const processedData: Record<string, any> = {
    ...blockData,
    "@type": "gridBlock",
    theme: blockData.theme || "default",
  };

  if (!blockData.blocks || typeof blockData.blocks !== "object") {
    return processedData;
  }

  // Get block order from blocks_layout if available, otherwise use object keys
  const blockOrder: string[] =
    blockData.blocks_layout?.items || Object.keys(blockData.blocks);

  const { blocks, blockIds } = processChildBlocks(
    blockData.blocks,
    blockOrder,
    "gridBlock",
    context
  );
  processedData.blocks = blocks;
  processedData.blocks_layout = { items: blockIds };

  return processedData;
}

/**
 * Default processor for blocks without specific handlers
 */
export function processDefaultBlock(
  blockData: Record<string, any>,
  blockType: string
): Record<string, any> {
  return { ...blockData, "@type": blockType };
}

// =============================================================================
// Registry
// =============================================================================

/**
 * Creates the block processor registry mapping block types to their handlers
 */
export function createBlockProcessorRegistry(): Record<string, BlockProcessor> {
  return {
    slate: processSlateBlock,
    text: processSlateBlock,
    image: processImageBlock,
    teaser: processTeaserBlock,
    __button: processButtonBlock,
    gridBlock: processGridBlock,
  };
}
