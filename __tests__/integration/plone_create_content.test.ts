import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Nock ,
  PloneMockServer,
  sampleDocument,
  createMockContext,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneCreateContent } from "plone-mcp/tools/plone_create_content";
import { PloneContent } from "plone-mcp/plone-client";
import * as BlockUtils from "plone-mcp/utils/block-utils";

describe("plone_create_content", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const parentPath = "/";
  const newContentId = "my-new-page";
  const newContentPath = `${parentPath}${newContentId}`;
  const mockContext = createMockContext();

  const mockCreatedContent = {
    ...sampleDocument,
    "@id": `${testBaseUrl}/++api++${newContentPath}`,
    id: newContentId,
    title: "My New Page",
  };

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);

    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);

    vi.spyOn(BlockUtils, "generateBlockId").mockImplementation(
      (
        (i = 0) =>
        () =>
          `mock-id-${++i}`
      )(),
    ); // Make generateBlockId return unique IDs
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Nock.cleanAll();
    vi.restoreAllMocks();
  });

  it("should successfully create simple content", async () => {
    mockServer.mockContentCreate(
      parentPath,
      (body: PloneContent) => {
        expect(body["@type"]).toBe("Document");
        expect(body.title).toBe("My New Page");
        if (body.blocks_layout && body.blocks) {
          if (!Array.isArray(body.blocks_layout.items)) {
            expect.fail("blocks_layout.items was not an array");
          }
          const layout = body.blocks_layout;
          const blocks = body.blocks;
          const titleBlockId = layout.items[0];
          expect(blocks[titleBlockId]).toEqual({ "@type": "title" });
        } else {
          expect.fail(
            "blocks_layout or blocks were unexpectedly undefined/null",
          );
        }
        return true;
      },
      mockCreatedContent,
    );

    const args = {
      parentPath: parentPath,
      type: "Document",
      title: "My New Page",
      description: "A description",
      id: undefined, // Explicitly undefined
      blocks: undefined, // Explicitly undefined
      blocks_layout: undefined, // Explicitly undefined
      additionalFields: undefined, // Explicitly undefined
    };

    const result = await ploneCreateContent.handler(args, mockContext);

    expect(JSON.parse(result.content[0].text)).toEqual(mockCreatedContent);
    expect(Nock.isDone()).toBe(true);
  });

  it("should create content with a specified ID", async () => {
    mockServer.mockContentCreate(
      parentPath,
      (body: PloneContent) => {
        expect(body["@type"]).toBe("Document");
        expect(body.title).toBe("My New Page");
        if (body.blocks_layout && body.blocks) {
          if (!Array.isArray(body.blocks_layout.items)) {
            expect.fail("blocks_layout.items was not an array");
          }
          const layout = body.blocks_layout;
          const blocks = body.blocks;
          const titleBlockId = layout.items[0];
          expect(blocks[titleBlockId]).toEqual({ "@type": "title" });
        } else {
          expect.fail(
            "blocks_layout or blocks were unexpectedly undefined/null",
          );
        }
        return true;
      },
      { ...mockCreatedContent, id: "custom-id" },
    );

    const args = {
      parentPath: parentPath,
      type: "Document",
      title: "My New Page",
      id: "custom-id",
      description: undefined, // Explicitly undefined
      blocks: undefined, // Explicitly undefined
      blocks_layout: undefined, // Explicitly undefined
      additionalFields: undefined, // Explicitly undefined
    };

    await ploneCreateContent.handler(args, mockContext);
    expect(Nock.isDone()).toBe(true);
  });

  it("should create content with block_specs in one call", async () => {
    mockServer.mockContentCreate(
      parentPath,
      (body: PloneContent) => {
        expect(body.blocks_layout?.items).toEqual(["mock-id-3", "mock-id-1", "mock-id-2"]);
        expect(body.blocks?.["mock-id-3"]).toEqual({ "@type": "title" });
        expect(body.blocks?.["mock-id-1"]).toMatchObject({ "@type": "slate", plaintext: "Hello World" });
        expect(body.blocks?.["mock-id-2"]).toMatchObject({ "@type": "slate", plaintext: "Second paragraph" });
        return true;
      },
      mockCreatedContent,
    );

    const args = {
      parentPath: parentPath,
      type: "Document",
      title: "Page with Blocks",
      block_specs: [
        { type: "slate" as const, data: { text: "Hello World" } },
        { type: "slate" as const, data: { text: "Second paragraph" } },
      ],
    };

    await ploneCreateContent.handler(args, mockContext);

    expect(Nock.isDone()).toBe(true);
  });

  it("should reject block_specs together with raw blocks", async () => {
    const args = {
      parentPath: parentPath,
      type: "Document",
      title: "Page",
      blocks: { a: { "@type": "slate", plaintext: "Inline text" } },
      block_specs: [{ type: "slate" as const, data: { text: "Hello" } }],
    };

    await expect(ploneCreateContent.handler(args, mockContext)).rejects.toThrow(
      "[CreateContent] Pass either block_specs or blocks/blocks_layout, not both.",
    );
    expect(Nock.pendingMocks()).toHaveLength(0);
  });

  it("should not call Plone when a block spec has an invalid image URL", async () => {
    vi.spyOn(BlockUtils, "validateImageURL").mockResolvedValue(false);
    const scope = mockServer.mockContentCreate(parentPath, () => true, mockCreatedContent);

    const args = {
      parentPath: parentPath,
      type: "Document",
      title: "Page",
      block_specs: [
        { type: "slate" as const, data: { text: "Hello" } },
        { type: "image" as const, data: { url: "http://example.com/missing.jpg" } },
      ],
    };

    await expect(ploneCreateContent.handler(args, mockContext)).rejects.toThrow(
      "[CreateContent] block_specs[1] (image): Invalid or inaccessible image URL: http://example.com/missing.jpg",
    );
    expect(scope.isDone()).toBe(false);
  });

  it("should create content with additional fields", async () => {
    const additionalFields = {
      effective: "2025-01-01T12:00:00Z",
      creators: ["author1"],
    };

    mockServer.mockContentCreate(
      parentPath,
      (body: PloneContent) => {
        expect(body["@type"]).toBe("Document");
        expect(body.title).toBe("Page with Extra Fields");
        expect(body.effective).toBe(additionalFields.effective);
        expect(body.creators).toEqual(additionalFields.creators);
        if (body.blocks_layout && body.blocks) {
          if (!Array.isArray(body.blocks_layout.items)) {
            expect.fail("blocks_layout.items was not an array");
          }
          const titleBlockId = body.blocks_layout.items[0];
          expect(body.blocks[titleBlockId]).toEqual({ "@type": "title" });
        } else {
          expect.fail(
            "blocks_layout or blocks were unexpectedly undefined/null",
          );
        }
        return true;
      },
      mockCreatedContent,
    );

    const args = {
      parentPath: parentPath,
      type: "Document",
      title: "Page with Extra Fields",
      additionalFields: additionalFields,
      description: undefined, // Explicitly undefined
      id: undefined, // Explicitly undefined
      blocks: undefined, // Explicitly undefined
      blocks_layout: undefined, // Explicitly undefined
    };

    await ploneCreateContent.handler(args, mockContext);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if content creation fails", async () => {
    mockServer.mockContentCreate(
      parentPath,
      () => true,
      500,
      "Server Error" as string,
    );

    const args = {
      parentPath: parentPath,
      type: "Document",
      title: "Failing Page",
    };

    await expect(ploneCreateContent.handler(args, mockContext)).rejects.toThrow(
      "[CreateContent] Request failed with status code 500",
    );
    expect(Nock.isDone()).toBe(true);
  });
});
