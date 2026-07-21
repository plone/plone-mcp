import { PloneClient } from "./plone-client.js";
import { generateBlockId, processBlock } from "./utils/block-utils.js";

export interface PreparedBlocks {
  blocks: Record<string, unknown>;
  blocks_layout: { items: string[] };
  timestamp: number;
}

export class PloneService {
  public client: PloneClient | null = null;
  private preparedBlocks: PreparedBlocks | null = null;
  private readonly PREPARED_BLOCKS_TTL = process.env.PLONE_PREPARED_BLOCKS_TTL
    ? parseInt(process.env.PLONE_PREPARED_BLOCKS_TTL, 10)
    : 60000; // 60 seconds TTL default

  constructor(client: PloneClient | null) {
    this.client = client;
  }

  public getClient(): PloneClient {
    if (!this.client) {
      throw new Error(
        "Plone client not configured. Please run plone_configure first.",
      );
    }
    return this.client;
  }

  public getPreparedBlocks(): PreparedBlocks | null {
    if (this.isExpiredPreparedBlocks()) {
      this.preparedBlocks = null; // Clear if expired
    }
    return this.preparedBlocks;
  }

  public setPreparedBlocks(blocks: PreparedBlocks): void {
    this.preparedBlocks = blocks;
  }

  public clearPreparedBlocks(): void {
    this.preparedBlocks = null;
  }

  // IMPROVEMENT: Check for expired prepared blocks
  private isExpiredPreparedBlocks(): boolean {
    if (!this.preparedBlocks) return true;
    return (
      Date.now() - this.preparedBlocks.timestamp > this.PREPARED_BLOCKS_TTL
    );
  }

  /**
   * Centralized logic for processing blocks and layout for create/update operations.
   * It handles blocks from direct arguments, prepared state, or defaults.
   * It also enforces that a title block exists and is the first item in the layout.
   * @param blocks - Blocks from tool arguments.
   * @param blocks_layout - Blocks layout from tool arguments.
   * @param isUpdate - Flag to indicate if this is for an update operation, which has slightly different rules.
   * @returns An object with final blocks and layout, or null if no block operations should occur.
   */
  public processBlocksForContent(
    blocks: Record<string, unknown> | undefined,
    blocks_layout: Record<string, unknown> | undefined,
    isUpdate = false,
  ): {
    blocks: Record<string, unknown>;
    blocks_layout: { items: string[] };
  } | null {
    // Determine if we should process blocks at all
    const preparedBlocks = this.getPreparedBlocks();
    const hasProvidedBlocks = Boolean(blocks || blocks_layout);
    const hasPreparedBlocks = Boolean(preparedBlocks);

    if (!hasProvidedBlocks && !hasPreparedBlocks) {
      // For updates, if no blocks are provided, do nothing.
      // For creates, we will add a default title block later.
      if (isUpdate) {
        return null;
      }
    }

    // Inline blocks take precedence over prepared ones
    let finalBlocks: Record<string, unknown> = {};
    let finalLayout: string[] = [];

    if (hasProvidedBlocks) {
      const rawBlocks = blocks || {};
      finalBlocks = {};
      const layoutItems = (blocks_layout as { items?: string[] } | undefined)
        ?.items;
      finalLayout = layoutItems ? [...layoutItems] : Object.keys(rawBlocks);

      // Process each provided block
      const baseUrl = this.client?.config.baseUrl;
      for (const id of finalLayout) {
        if (rawBlocks[id]) {
          const blockData = rawBlocks[id] as Record<string, unknown>;
          const blockType = (blockData["@type"] as string) || "text";
          finalBlocks[id] = processBlock(blockType, blockData, baseUrl);
        }
      }
    } else if (hasPreparedBlocks && preparedBlocks) {
      finalBlocks = { ...preparedBlocks.blocks };
      finalLayout = [...preparedBlocks.blocks_layout.items];
    }

    // Prepared blocks should never leak into the next operation
    this.clearPreparedBlocks();

    // Find the existing title block
    let titleBlockId = finalLayout.find(
      (id: string) =>
        (finalBlocks[id] as { "@type"?: string })?.["@type"] === "title",
    );

    if (!titleBlockId) {
      // If no title block exists, create one and add it to the front
      titleBlockId = generateBlockId();
      finalLayout.unshift(titleBlockId);
    } else if (finalLayout[0] !== titleBlockId) {
      // If it exists but isn't first, move it to the front
      finalLayout = finalLayout.filter((id: string) => id !== titleBlockId);
      finalLayout.unshift(titleBlockId);
    }

    // ALWAYS ensure the title block is clean and contains only the @type
    finalBlocks[titleBlockId] = { "@type": "title" };

    return {
      blocks: finalBlocks,
      blocks_layout: { items: finalLayout },
    };
  }

  // --- Start of removed handle* methods ---
  // All handle* methods (handleConfigure, handleGetContent, etc.) have been removed.
  // These will be moved to their respective tool files.
  // --- End of removed handle* methods ---
}
