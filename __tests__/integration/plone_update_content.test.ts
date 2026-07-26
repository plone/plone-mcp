import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Nock ,
  PloneMockServer,
  sampleDocument,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneUpdateContent } from "plone-mcp/tools/plone_update_content";
import { sessionManager } from "plone-mcp/session-manager";
import { PloneClient } from "plone-mcp/plone-client";
import * as BlockUtils from "plone-mcp/utils/block-utils"; // Import for mocking generateBlockId
import { PreparedBlocks } from "plone-mcp/plone-service";

describe("plone_update_content", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/my-page";
  const sessionId = "test-session-id";
  const mockExtra = {
    sessionId,
    signal: new AbortController().signal,
    requestId: "test-request-id",
  } as any;
  const mockContent = {
    ...sampleDocument,
    "@id": `${testBaseUrl}/++api++${testPath}`,
    id: "my-page",
    title: "Original Title",
    description: "Original Description",
    blocks: {},
    blocks_layout: { items: [] },
  };

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);
    const service = sessionManager.getSession(sessionId);
    service.client = new PloneClient({ baseUrl: testBaseUrl });
    service.clearPreparedBlocks(); // Ensure no prepared blocks initially
    vi.spyOn(BlockUtils, "generateBlockId").mockImplementation(
      () => "mock-title-block-id",
    ); // Mock for title block generation
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.restoreAllMocks();
    const service = sessionManager.getSession(sessionId);
    service.clearPreparedBlocks();
  });

  it("should successfully update title and description", async () => {
    const updatedTitle = "Updated Title";
    const updatedDescription = "Updated Description";
    const expectedPatchBody = {
      title: updatedTitle,
      description: updatedDescription,
    };
    const mockUpdatedContent = { ...mockContent, ...expectedPatchBody };

    mockServer.mockContentUpdate(
      testPath,
      expectedPatchBody,
      mockUpdatedContent,
    );

    const args = {
      path: testPath,
      title: updatedTitle,
      description: updatedDescription,
      blocks: undefined,
      blocks_layout: undefined,
      additionalFields: undefined,
    };

    const result = await ploneUpdateContent.handler(args, mockExtra);

    expect(JSON.parse(result.content[0].text)).toEqual(mockUpdatedContent);
    expect(Nock.isDone()).toBe(true);
  });

  it("should update content with prepared blocks and clear them after", async () => {
    const preparedBlocksData: PreparedBlocks = {
      blocks: {
        "block-1": { "@type": "slate", plaintext: "Prepared text for update" },
      },
      blocks_layout: { items: ["block-1"] },
      timestamp: Date.now(),
    };
    const service = sessionManager.getSession(sessionId);
    service.setPreparedBlocks(preparedBlocksData);

    const mockResponseWithPreparedBlocks = {
      ...mockContent,
      blocks: {
        "mock-title-block-id": { "@type": "title" },
        "block-1": { "@type": "slate", plaintext: "Prepared text for update" },
      },
      blocks_layout: { items: ["mock-title-block-id", "block-1"] },
    };

    const expectedPatchBody = (body: Record<string, unknown>) => {
      expect(body.blocks).toMatchObject({
        "mock-title-block-id": { "@type": "title" },
        "block-1": { "@type": "slate", plaintext: "Prepared text for update" },
      });
      expect((body.blocks_layout as { items: string[] }).items).toEqual([
        "mock-title-block-id",
        "block-1",
      ]);
      return true;
    };
    mockServer.mockContentUpdate(
      testPath,
      expectedPatchBody,
      mockResponseWithPreparedBlocks,
    );

    const args = {
      path: testPath, // No inline blocks, should use prepared
      title: undefined,
      description: undefined,
      blocks: undefined,
      blocks_layout: undefined,
      additionalFields: undefined,
    };

    await ploneUpdateContent.handler(args, mockExtra);

    expect(service.getPreparedBlocks()).toBeNull(); // Should be cleared
    expect(Nock.isDone()).toBe(true);
  });

  it("should prioritize inline blocks over prepared blocks during update", async () => {
    const preparedBlocksData: PreparedBlocks = {
      blocks: {
        "block-prepared": { "@type": "slate", plaintext: "Prepared text" },
      },
      blocks_layout: { items: ["block-prepared"] },
      timestamp: Date.now(),
    };
    const service = sessionManager.getSession(sessionId);
    service.setPreparedBlocks(preparedBlocksData);

    const inlineBlocks = {
      "block-inline": { "@type": "slate", plaintext: "Inline text for update" },
    };
    const inlineLayout = { items: ["block-inline"] };

    const mockResponseWithInlineBlocks = {
      ...mockContent,
      blocks: {
        "mock-title-block-id": { "@type": "title" },
        ...inlineBlocks,
      },
      blocks_layout: { items: ["mock-title-block-id", ...inlineLayout.items] },
    };

    const expectedPatchBody = (body: Record<string, unknown>) => {
      expect(body.blocks).toMatchObject({
        "mock-title-block-id": { "@type": "title" },
        ...inlineBlocks,
      });
      expect((body.blocks_layout as { items: string[] }).items).toEqual([
        "mock-title-block-id",
        ...inlineLayout.items,
      ]);
      return true;
    };
    mockServer.mockContentUpdate(
      testPath,
      expectedPatchBody,
      mockResponseWithInlineBlocks,
    );

    const args = {
      path: testPath,
      blocks: inlineBlocks,
      blocks_layout: inlineLayout,
      title: undefined,
      description: undefined,
      additionalFields: undefined,
    };

    await ploneUpdateContent.handler(args, mockExtra);

    expect(service.getPreparedBlocks()).toBeNull(); // Prepared should still be cleared
    expect(Nock.isDone()).toBe(true);
  });

  it("should update content with additional fields", async () => {
    const additionalFields = {
      effective: "2025-01-01T12:00:00Z",
      creators: ["author2"],
    };
    const expectedPatchBody = { ...additionalFields };
    const mockUpdatedContent = { ...mockContent, ...expectedPatchBody };

    mockServer.mockContentUpdate(
      testPath,
      expectedPatchBody,
      mockUpdatedContent,
    );

    const args = {
      path: testPath,
      additionalFields: additionalFields,
      title: undefined,
      description: undefined,
      blocks: undefined,
      blocks_layout: undefined,
    };

    await ploneUpdateContent.handler(args, mockExtra);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if no changes are specified", async () => {
    const args = {
      path: testPath, // Only path, no title, description, blocks, or additionalFields
      title: undefined,
      description: undefined,
      blocks: undefined,
      blocks_layout: undefined,
      additionalFields: undefined,
    };

    await expect(ploneUpdateContent.handler(args, mockExtra)).rejects.toThrow(
      "No changes specified for update",
    );
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });

  it("should throw an error if path is missing", async () => {
    const args = {
      title: "New title",
      description: undefined,
      blocks: undefined,
      blocks_layout: undefined,
      additionalFields: undefined,
    } as any;
    await expect(
      ploneUpdateContent.handler(args, mockExtra),
    ).rejects.toThrow("Path is required for updating content");
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });

  it("should throw an error if content update fails and clear prepared blocks", async () => {
    const preparedBlocksData: PreparedBlocks = {
      blocks: {
        "block-1": { "@type": "slate", plaintext: "Prepared text" },
      },
      blocks_layout: { items: ["block-1"] },
      timestamp: Date.now(),
    };
    const service = sessionManager.getSession(sessionId);
    service.setPreparedBlocks(preparedBlocksData);

    Nock(testBaseUrl, {
      reqheaders: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "user-agent": /.*/,
        "accept-encoding": /.*/,
      },
    })
      .patch(`/++api++${testPath}`)
      .reply(500, "Server Error");

    const args = {
      path: testPath,
      title: "Failing Update",
      description: undefined,
      blocks: undefined,
      blocks_layout: undefined,
      additionalFields: undefined,
    };

    await expect(ploneUpdateContent.handler(args, mockExtra)).rejects.toThrow(
      "[UpdateContent] Request failed with status code 500",
    );
    expect(service.getPreparedBlocks()).toBeNull(); // Should be cleared
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    const args = {
      path: testPath,
      title: "New Title",
      description: undefined,
      blocks: undefined,
      blocks_layout: undefined,
      additionalFields: undefined,
    };
    await expect(ploneUpdateContent.handler(args, mockExtra)).rejects.toThrow(
      "Plone client not configured. Please run plone_configure first.",
    );
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });
});
