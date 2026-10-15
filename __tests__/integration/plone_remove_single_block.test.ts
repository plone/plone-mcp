import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock ,
  PloneMockServer,
  sampleDocument,
  createMockContext,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneRemoveSingleBlock } from "plone-mcp/tools/plone_remove_single_block";

describe("plone_remove_single_block", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/my-page";
  const blockToRemoveId = "block-to-remove";
  const remainingBlockId = "block-remaining";

  const mockContentWithBlock = {
    ...sampleDocument,
    "@id": `${testBaseUrl}/++api++${testPath}`,
    id: "my-page",
    blocks: {
      [blockToRemoveId]: { "@type": "text", plaintext: "Block to remove" },
      [remainingBlockId]: { "@type": "text", plaintext: "Remaining block" },
    },
    blocks_layout: {
      items: [blockToRemoveId, remainingBlockId],
    },
  };

  const mockContentAfterRemoval = {
    ...sampleDocument,
    "@id": `${testBaseUrl}/++api++${testPath}`,
    id: "my-page",
    blocks: {
      [remainingBlockId]: { "@type": "text", plaintext: "Remaining block" },
    },
    blocks_layout: {
      items: [remainingBlockId],
    },
  };

  const defaultReqHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const mockContext = createMockContext();

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.unstubAllEnvs();
  });

  it("should successfully remove a block", async () => {
    mockServer.mockContentGet(testPath, mockContentWithBlock);
    mockServer.mockContentUpdate(
      testPath,
      (body: {
        blocks: Record<string, unknown>;
        blocks_layout: { items: string[] };
      }) => {
        expect(body.blocks).not.toHaveProperty(blockToRemoveId);
        expect(body.blocks_layout.items).not.toContain(blockToRemoveId);
        expect(body.blocks_layout.items).toContain(remainingBlockId);
        return true;
      },
      mockContentAfterRemoval,
    );

    const args = { path: testPath, blockId: blockToRemoveId };
    const result = await ploneRemoveSingleBlock.handler(args, mockContext);

    expect(JSON.parse(result.content[0].text)).toEqual(mockContentAfterRemoval);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if attempting to remove a non-existent block", async () => {
    mockServer.mockContentGet(testPath, mockContentWithBlock);
    // No mock for patch, as it should not be called

    const nonExistentBlockId = "non-existent-block";
    const args = { path: testPath, blockId: nonExistentBlockId };

    await expect(ploneRemoveSingleBlock.handler(args, mockContext)).rejects.toThrow(
      `[RemoveBlock] Block with ID '${nonExistentBlockId}' not found. Available block IDs: ${blockToRemoveId}, ${remainingBlockId}`,
    );
    expect(Nock.pendingMocks()).toHaveLength(0); // No patch request should have been made
  });

  it("should throw an error if content retrieval fails", async () => {
    Nock(testBaseUrl, { reqheaders: defaultReqHeaders })
      .get(`/++api++${testPath}`)
      .reply(404, "Not Found");

    const args = { path: testPath, blockId: blockToRemoveId };
    await expect(ploneRemoveSingleBlock.handler(args, mockContext)).rejects.toThrow(
      `[RemoveBlock] Request failed with status code 404`,
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if content update fails", async () => {
    mockServer.mockContentGet(testPath, mockContentWithBlock);
    Nock(testBaseUrl, { reqheaders: defaultReqHeaders })
      .patch(`/++api++${testPath}`)
      .reply(500, "Server Error");

    const args = { path: testPath, blockId: blockToRemoveId };
    await expect(ploneRemoveSingleBlock.handler(args, mockContext)).rejects.toThrow(
      `[RemoveBlock] Request failed with status code 500`,
    );
    expect(Nock.isDone()).toBe(true);
  });
});
