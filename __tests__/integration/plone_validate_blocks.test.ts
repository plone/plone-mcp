import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneValidateBlocks } from "plone-mcp/tools/plone_validate_blocks";
import * as BlockUtils from "plone-mcp/utils/block-utils";

describe("plone_validate_blocks", () => {
  const testBaseUrl = "http://localhost:8080/Plone";
  const mockContext = createMockContext();

  beforeEach(() => {
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
    vi.spyOn(BlockUtils, "validateImageURL").mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reports valid specs without returning block JSON", async () => {
    const result = await ploneValidateBlocks.handler(
      {
        block_specs: [
          { type: "slate", data: { text: "Hello World" } },
          { type: "image", data: { url: "http://example.com/image.jpg" } },
        ],
      },
      mockContext,
    );

    expect(result.content).toEqual([
      { type: "text", text: "All 2 block specs are valid." },
    ]);
    expect(BlockUtils.validateImageURL).toHaveBeenCalledWith(
      "http://example.com/image.jpg",
      testBaseUrl,
    );
  });

  it("names the invalid spec", async () => {
    vi.spyOn(BlockUtils, "validateImageURL").mockResolvedValue(false);

    await expect(
      ploneValidateBlocks.handler(
        {
          block_specs: [
            { type: "image", data: { url: "http://example.com/missing.jpg" } },
          ],
        },
        mockContext,
      ),
    ).rejects.toThrow(
      "[ValidateBlocks] block_specs[0] (image): Invalid or inaccessible image URL: http://example.com/missing.jpg",
    );
  });
});
