import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ploneGetBlockSchemas } from "plone-mcp/tools/plone_get_block_schemas";
import { blockRegistry } from "plone-mcp/block-registry";
import * as BlockUtils from "plone-mcp/utils/block-utils"; // Import BlockUtils for mocking getBlockExample

describe("plone_get_block_schemas", () => {
  const sessionId = "test-session-id";
  const mockExtra = {
    sessionId,
    signal: new AbortController().signal,
    requestId: "test-request-id",
  } as any;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return the schema for a specific, valid block type", async () => {
    const mockBlockType = "teaser";
    const mockSpec = {
      properties: {
        href: { type: "string" },
        title: { type: "string" },
      },
    };
    const mockExample = { title: "Test Teaser" };

    // Mock blockRegistry.getSpecification
    vi.spyOn(blockRegistry, "getSpecification").mockReturnValue(mockSpec);
    vi.spyOn(BlockUtils, "getBlockExample").mockReturnValue(mockExample);

    const args = { blockType: mockBlockType };
    const result = await ploneGetBlockSchemas.handler(args, mockExtra);
    const parsedContent = JSON.parse(result.content[0].text);

    expect(parsedContent.blockType).toBe(mockBlockType);
    expect(parsedContent.specification).toEqual(mockSpec);
    expect(parsedContent.example).toEqual(mockExample);
    expect(blockRegistry.getSpecification).toHaveBeenCalledWith(mockBlockType);
    expect(BlockUtils.getBlockExample).toHaveBeenCalledWith(mockBlockType);
  });

  it("should return all block schemas when no blockType is specified", async () => {
    const mockAvailableTypes = ["text", "image", "teaser"];
    const mockSpecifications = {
      text: { properties: { text: { type: "string" } } },
      image: { properties: { url: { type: "string" } } },
      teaser: { properties: { title: { type: "string" } } },
    };
    const mockExamples: Record<string, unknown> = {
      text: { text: "Sample Text" },
      image: { url: "sample.jpg" },
      teaser: { title: "Sample Teaser" },
    };

    vi.spyOn(blockRegistry, "getBlockTypes").mockReturnValue(
      mockAvailableTypes,
    );
    vi.spyOn(blockRegistry, "getSpecifications").mockReturnValue(
      mockSpecifications,
    );
    vi.spyOn(BlockUtils, "getBlockExample").mockImplementation(
      (type) => mockExamples[type],
    );

    const args = { blockType: undefined }; // No blockType specified
    const result = await ploneGetBlockSchemas.handler(args, mockExtra);
    const parsedContent = JSON.parse(result.content[0].text);

    expect(parsedContent.availableTypes).toEqual(mockAvailableTypes);
    expect(parsedContent.specifications).toEqual(mockSpecifications);
    expect(parsedContent.examples).toEqual(mockExamples);
    expect(blockRegistry.getBlockTypes).toHaveBeenCalled();
    expect(blockRegistry.getSpecifications).toHaveBeenCalled();
    expect(BlockUtils.getBlockExample).toHaveBeenCalledTimes(
      mockAvailableTypes.length,
    );
  });

  it("should throw an error for an unknown blockType", async () => {
    const unknownBlockType = "nonExistentBlock";
    vi.spyOn(blockRegistry, "getSpecification").mockReturnValue(undefined); // Simulate unknown block
    vi.spyOn(blockRegistry, "getBlockTypes").mockReturnValue(["text", "image"]);

    const args = { blockType: unknownBlockType };
    await expect(ploneGetBlockSchemas.handler(args, mockExtra)).rejects.toThrow(
      `Unknown block type: ${unknownBlockType}. Available types: text, image`,
    );
    expect(blockRegistry.getSpecification).toHaveBeenCalledWith(
      unknownBlockType,
    );
  });

  it("should handle errors during schema retrieval (e.g., from an internal utility)", async () => {
    vi.spyOn(blockRegistry, "getBlockTypes").mockImplementation(() => {
      throw new Error("Mock block registry error");
    });

    const args = { blockType: undefined };
    await expect(ploneGetBlockSchemas.handler(args, mockExtra)).rejects.toThrow(
      "[GetBlockSchemas] Mock block registry error",
    );
  });
});
