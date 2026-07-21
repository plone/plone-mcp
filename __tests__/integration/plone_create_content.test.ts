import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Nock ,
  PloneMockServer,
  sampleDocument,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneCreateContent } from "plone-mcp/tools/plone_create_content";
import { sessionManager } from "plone-mcp/session-manager";
import { PloneClient, PloneContent } from "plone-mcp/plone-client";
import * as BlockUtils from "plone-mcp/utils/block-utils";
import { PreparedBlocks } from "plone-mcp/plone-service";

describe("plone_create_content", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const parentPath = "/";
  const newContentId = "my-new-page";
  const newContentPath = `${parentPath}${newContentId}`;
  const sessionId = "test-session-id";
  const mockExtra = {
    sessionId,
    signal: new AbortController().signal,
    requestId: "test-request-id",
  } as any;

  const mockCreatedContent = {
    ...sampleDocument,
    "@id": `${testBaseUrl}/++api++${newContentPath}`,
    id: newContentId,
    title: "My New Page",
  };

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);

    const service = sessionManager.getSession(sessionId);
    service.client = new PloneClient({ baseUrl: testBaseUrl });
    service.clearPreparedBlocks(); // Ensure no prepared blocks initially

    vi.spyOn(BlockUtils, "generateBlockId").mockImplementation(
      (
        (i = 0) =>
        () =>
          `mock-id-${++i}`
      )(),
    ); // Make generateBlockId return unique IDs
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.restoreAllMocks();
    const service = sessionManager.getSession(sessionId);
    service.clearPreparedBlocks();
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

    const result = await ploneCreateContent.handler(args, mockExtra);

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

    await ploneCreateContent.handler(args, mockExtra);
    expect(Nock.isDone()).toBe(true);
  });

  it("should create content with prepared blocks and clear them after", async () => {
    // Generate unique IDs for prepared blocks, separate from the title block
    const preparedBlockId = BlockUtils.generateBlockId();
    const preparedBlocksData: PreparedBlocks = {
      blocks: {
        [preparedBlockId]: { "@type": "slate", plaintext: "Prepared text" },
      },
      blocks_layout: { items: [preparedBlockId] },
      timestamp: Date.now(),
    };

    const service = sessionManager.getSession(sessionId);
    service.setPreparedBlocks(preparedBlocksData);

    mockServer.mockContentCreate(
      parentPath,
      (body: PloneContent) => {
        if (body.blocks_layout && body.blocks_layout.items && body.blocks) {
          const titleBlockId = body.blocks_layout.items[0];
          expect(body.blocks).toMatchObject({
            [titleBlockId]: { "@type": "title" },
            [preparedBlockId]: { "@type": "slate", plaintext: "Prepared text" },
          });
          expect(body.blocks_layout.items).toEqual([
            titleBlockId,
            preparedBlockId,
          ]);
        } else {
          expect.fail("blocks_layout or blocks were undefined");
        }
        return true;
      },
      mockCreatedContent,
    );

    const args = {
      parentPath: parentPath,
      type: "Document",
      title: "Page with Prepared Blocks",
      description: undefined, // Explicitly undefined
      id: undefined, // Explicitly undefined
      blocks: undefined, // Explicitly undefined
      blocks_layout: undefined, // Explicitly undefined
      additionalFields: undefined, // Explicitly undefined
    };

    await ploneCreateContent.handler(args, mockExtra);

    expect(service.getPreparedBlocks()).toBeNull(); // Should be cleared
    expect(Nock.isDone()).toBe(true);
  });

  it("should prioritize inline blocks over prepared blocks", async () => {
    const preparedBlockId = BlockUtils.generateBlockId();
    const preparedBlocksData: PreparedBlocks = {
      blocks: {
        [preparedBlockId]: { "@type": "slate", plaintext: "Prepared text" },
      },
      blocks_layout: { items: [preparedBlockId] },
      timestamp: Date.now(),
    };

    const service = sessionManager.getSession(sessionId);
    service.setPreparedBlocks(preparedBlocksData);

    const inlineBlockId = BlockUtils.generateBlockId();
    const inlineBlocks = {
      [inlineBlockId]: { "@type": "slate", plaintext: "Inline text" },
    };
    const inlineLayout = { items: [inlineBlockId] };

    mockServer.mockContentCreate(
      parentPath,
      (body: PloneContent) => {
        if (body.blocks_layout && body.blocks_layout.items && body.blocks) {
          const titleBlockId = body.blocks_layout.items[0];
          expect(body.blocks).toMatchObject({
            [titleBlockId]: { "@type": "title" },
            ...inlineBlocks,
          });
          expect(body.blocks_layout.items).toEqual([
            titleBlockId,
            ...inlineLayout.items,
          ]);
        } else {
          expect.fail("blocks_layout or blocks were undefined");
        }
        return true;
      },
      mockCreatedContent,
    );

    const args = {
      parentPath: parentPath,
      type: "Document",
      title: "Page with Inline Blocks",
      blocks: inlineBlocks,
      blocks_layout: inlineLayout,
      description: undefined, // Explicitly undefined
      id: undefined, // Explicitly undefined
      additionalFields: undefined, // Explicitly undefined
    };

    await ploneCreateContent.handler(args, mockExtra);

    expect(service.getPreparedBlocks()).toBeNull(); // Still cleared
    expect(Nock.isDone()).toBe(true);
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

    await ploneCreateContent.handler(args, mockExtra);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if content creation fails and clear prepared blocks", async () => {
    const preparedBlockId = BlockUtils.generateBlockId();
    const preparedBlocksData: PreparedBlocks = {
      blocks: {
        [preparedBlockId]: { "@type": "slate", plaintext: "Prepared text" },
      },
      blocks_layout: { items: [preparedBlockId] },
      timestamp: Date.now(),
    };

    const service = sessionManager.getSession(sessionId);
    service.setPreparedBlocks(preparedBlocksData);

    mockServer.mockContentCreate(
      parentPath,
      (body: PloneContent) => {
        if (body.blocks_layout && body.blocks_layout.items && body.blocks) {
          const titleBlockId = body.blocks_layout.items[0];
          expect(body.blocks).toMatchObject({
            [titleBlockId]: { "@type": "title" },
            [preparedBlockId]: { "@type": "slate", plaintext: "Prepared text" },
          });
          expect(body.blocks_layout.items).toEqual([
            titleBlockId,
            preparedBlockId,
          ]);
        } else {
          expect.fail("blocks_layout or blocks were undefined");
        }
        return true;
      },
      500,
      "Server Error" as string,
    );

    const args = {
      parentPath: parentPath,
      type: "Document",
      title: "Failing Page",
      description: undefined, // Explicitly undefined
      id: undefined, // Explicitly undefined
      blocks: undefined, // Explicitly undefined
      blocks_layout: undefined, // Explicitly undefined
      additionalFields: undefined, // Explicitly undefined
    };

    await expect(ploneCreateContent.handler(args, mockExtra)).rejects.toThrow(
      "[CreateContent] Request failed with status code 500",
    );
    expect(service.getPreparedBlocks()).toBeNull(); // Should be cleared
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    const args = {
      parentPath: parentPath,
      type: "Document",
      title: "My New Page",
      description: undefined, // Explicitly undefined
      id: undefined, // Explicitly undefined
      blocks: undefined, // Explicitly undefined
      blocks_layout: undefined, // Explicitly undefined
      additionalFields: undefined, // Explicitly undefined
    };

    await expect(ploneCreateContent.handler(args, mockExtra)).rejects.toThrow(
      "Plone client not configured. Please run plone_configure first.",
    );
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });
});
