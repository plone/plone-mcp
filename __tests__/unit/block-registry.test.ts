import { describe, it, expect } from "vitest";
import { BlockRegistry } from "../../src/block-registry";

describe("BlockRegistry", () => {
  const mockSpecs = {
    slate: { title: "Slate" },
    image: { title: "Image" },
  };

  it("should return block types", () => {
    const registry = new BlockRegistry(mockSpecs);
    expect(registry.getBlockTypes()).toEqual(["slate", "image"]);
  });

  it("should return block types enum as a tuple", () => {
    const registry = new BlockRegistry(mockSpecs);
    expect(registry.getBlockTypesEnum()).toEqual(["slate", "image"]);
  });

  it("should throw if no block types available for enum", () => {
    const registry = new BlockRegistry({});
    expect(() => registry.getBlockTypesEnum()).toThrow(/No block types available/);
  });

  it("should return all specifications", () => {
    const registry = new BlockRegistry(mockSpecs);
    expect(registry.getSpecifications()).toBe(mockSpecs);
  });

  it("should return single specification", () => {
    const registry = new BlockRegistry(mockSpecs);
    expect(registry.getSpecification("slate")).toBe(mockSpecs.slate);
    expect(registry.getSpecification("unknown")).toBeUndefined();
  });
});
