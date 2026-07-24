/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Load block specifications from JSON.
// Read from disk instead of using an import attribute (`with { type: "json" }`),
// which is not supported by all Node versions the MCP host may spawn.
const blocksJsonPath = fileURLToPath(new URL("./blocks.json", import.meta.url));
export const blocksSpecification = JSON.parse(
  readFileSync(blocksJsonPath, "utf-8"),
) as Record<string, unknown>;

/**
 * BlockRegistry for centralizing block type management
 */
export class BlockRegistry {
  private specifications: Record<string, unknown>;

  constructor(specs: Record<string, unknown>) {
    this.specifications = specs;
  }

  getBlockTypes(): string[] {
    return Object.keys(this.specifications);
  }

  getBlockTypesEnum(): [string, ...string[]] {
    const types = this.getBlockTypes();
    if (types.length === 0) {
      throw new Error("No block types available");
    }
    return types as [string, ...string[]];
  }

  getSpecifications(): Record<string, unknown> {
    return this.specifications;
  }

  getSpecification(blockType: string): unknown {
    return this.specifications[blockType];
  }
}

// Initialize block registry
export const blockRegistry = new BlockRegistry(blocksSpecification);
