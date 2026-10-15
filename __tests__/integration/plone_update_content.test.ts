import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Nock ,
  PloneMockServer,
  sampleDocument,
  createMockContext,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneUpdateContent } from "plone-mcp/tools/plone_update_content";
import * as BlockUtils from "plone-mcp/utils/block-utils"; // Import for mocking generateBlockId

describe("plone_update_content", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/my-page";
  const mockContext = createMockContext();
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
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
    vi.spyOn(BlockUtils, "generateBlockId").mockImplementation(
      () => "mock-title-block-id",
    ); // Mock for title block generation
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Nock.cleanAll();
    vi.restoreAllMocks();
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

    const result = await ploneUpdateContent.handler(args, mockContext);

    expect(JSON.parse(result.content[0].text)).toEqual(mockUpdatedContent);
    expect(Nock.isDone()).toBe(true);
  });

  it("should replace blocks with block_specs in one call", async () => {
    let idCounter = 0;
    vi.spyOn(BlockUtils, "generateBlockId").mockImplementation(
      () => `mock-id-${++idCounter}`,
    );

    const expectedPatchBody = (body: Record<string, unknown>) => {
      expect((body.blocks_layout as { items: string[] }).items).toEqual([
        "mock-id-2",
        "mock-id-1",
      ]);
      expect(body.blocks).toMatchObject({
        "mock-id-2": { "@type": "title" },
        "mock-id-1": { "@type": "slate", plaintext: "Updated text" },
      });
      return true;
    };
    mockServer.mockContentUpdate(testPath, expectedPatchBody, mockContent);

    const args = {
      path: testPath,
      block_specs: [{ type: "slate" as const, data: { text: "Updated text" } }],
    };

    await ploneUpdateContent.handler(args, mockContext);

    expect(Nock.isDone()).toBe(true);
  });

  it("should reject block_specs together with raw blocks", async () => {
    const args = {
      path: testPath,
      blocks_layout: { items: [] },
      block_specs: [{ type: "slate" as const, data: { text: "Hello" } }],
    };

    await expect(ploneUpdateContent.handler(args, mockContext)).rejects.toThrow(
      "[UpdateContent] Pass either block_specs or blocks/blocks_layout, not both.",
    );
    expect(Nock.pendingMocks()).toHaveLength(0);
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

    await ploneUpdateContent.handler(args, mockContext);
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

    await expect(ploneUpdateContent.handler(args, mockContext)).rejects.toThrow(
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
      ploneUpdateContent.handler(args, mockContext),
    ).rejects.toThrow("Path is required for updating content");
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });

  it("should throw an error if content update fails", async () => {
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
    };

    await expect(ploneUpdateContent.handler(args, mockContext)).rejects.toThrow(
      "[UpdateContent] Request failed with status code 500",
    );
    expect(Nock.isDone()).toBe(true);
  });
});
