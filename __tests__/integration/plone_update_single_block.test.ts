import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock ,
  PloneMockServer,
  sampleDocument,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneUpdateSingleBlock } from "plone-mcp/tools/plone_update_single_block";
import { PloneClient } from "plone-mcp/plone-client";
import { sessionManager } from "plone-mcp/session-manager";

describe("plone_update_single_block", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/my-page";
  const blockToUpdateId = "block-to-update";
  const existingBlockData = {
    "@type": "text",
    plaintext: "Original text",
    value: [],
  };

  const mockContentWithBlock = {
    ...sampleDocument,
    "@id": `${testBaseUrl}/++api++${testPath}`,
    id: "my-page",
    blocks: {
      [blockToUpdateId]: existingBlockData,
    },
    blocks_layout: {
      items: [blockToUpdateId],
    },
  };

  const updatedBlockData = { plaintext: "Updated text" };
  const mockContentAfterUpdate = {
    ...mockContentWithBlock,
    blocks: {
      [blockToUpdateId]: { ...existingBlockData, ...updatedBlockData },
    },
  };

  const defaultReqHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const sessionId = "test-session-id";
  const mockExtra = {
    sessionId,
    signal: new AbortController().signal,
    requestId: "test-request-id",
  } as any;

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);
    const service = sessionManager.getSession(sessionId);
    service.client = new PloneClient({ baseUrl: testBaseUrl });
  });

  afterEach(() => {
    Nock.cleanAll();
    sessionManager.clearSession(sessionId);
  });

  it("should successfully update an existing block", async () => {
    mockServer.mockContentGet(testPath, mockContentWithBlock);
    mockServer.mockContentUpdate(
      testPath,
      (body: { blocks: Record<string, unknown> }) => {
        expect(
          (body.blocks[blockToUpdateId] as { plaintext: string }).plaintext,
        ).toBe(updatedBlockData.plaintext);
        return true;
      },
      mockContentAfterUpdate,
    );

    const args = {
      path: testPath,
      blockId: blockToUpdateId,
      blockData: updatedBlockData,
    };
    const result = await ploneUpdateSingleBlock.handler(args, mockExtra);

    expect(JSON.parse(result.content[0].text)).toEqual(mockContentAfterUpdate);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if attempting to update a non-existent block", async () => {
    mockServer.mockContentGet(testPath, mockContentWithBlock);
    // No mock for patch, as it should not be called

    const nonExistentBlockId = "non-existent-block";
    const args = {
      path: testPath,
      blockId: nonExistentBlockId,
      blockData: updatedBlockData,
    };

    await expect(ploneUpdateSingleBlock.handler(args, mockExtra)).rejects.toThrow(
      `[UpdateBlock] Block with ID '${nonExistentBlockId}' not found. Available block IDs: ${blockToUpdateId}`,
    );
    expect(Nock.pendingMocks()).toHaveLength(0); // No patch request should have been made
  });

  it("should throw an error if content retrieval fails", async () => {
    Nock(testBaseUrl, { reqheaders: defaultReqHeaders })
      .get(`/++api++${testPath}`)
      .reply(404, "Not Found");

    const args = {
      path: testPath,
      blockId: blockToUpdateId,
      blockData: updatedBlockData,
    };
    await expect(ploneUpdateSingleBlock.handler(args, mockExtra)).rejects.toThrow(
      `[UpdateBlock] Request failed with status code 404`,
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if content update fails", async () => {
    mockServer.mockContentGet(testPath, mockContentWithBlock);
    Nock(testBaseUrl, { reqheaders: defaultReqHeaders })
      .patch(`/++api++${testPath}`)
      .reply(500, "Server Error");

    const args = {
      path: testPath,
      blockId: blockToUpdateId,
      blockData: updatedBlockData,
    };
    await expect(ploneUpdateSingleBlock.handler(args, mockExtra)).rejects.toThrow(
      `[UpdateBlock] Request failed with status code 500`,
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    const args = {
      path: testPath,
      blockId: blockToUpdateId,
      blockData: updatedBlockData,
    };
    await expect(ploneUpdateSingleBlock.handler(args, mockExtra)).rejects.toThrow(
      "Plone client not configured. Please run plone_configure first.",
    );
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });
});
