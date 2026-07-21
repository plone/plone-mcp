/// <reference types="node" />
import blocksJson from "./blocks.json" with { type: "json" };

// Load block specifications from JSON
export const blocksSpecification = blocksJson;

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
