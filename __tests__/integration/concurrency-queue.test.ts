import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  Nock,
  PloneMockServer,
  sampleDocument,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneAddSingleBlock } from "plone-mcp/tools/plone_add_single_block";
import { ploneRemoveSingleBlock } from "plone-mcp/tools/plone_remove_single_block";
import { PloneClient } from "plone-mcp/plone-client";
import { sessionManager } from "plone-mcp/session-manager";
import * as BlockUtils from "plone-mcp/utils/block-utils";

describe("concurrency queue for single-block mutations", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/my-page";

  const blockToRemoveId1 = "block-to-remove-1";
  const blockToRemoveId2 = "block-to-remove-2";

  const mockContentWithBothBlocks = {
    ...sampleDocument,
    "@id": `${testBaseUrl}/++api++${testPath}`,
    id: "my-page",
    blocks: {
      [blockToRemoveId1]: { "@type": "text", plaintext: "Block to remove 1" },
      [blockToRemoveId2]: { "@type": "text", plaintext: "Block to remove 2" },
    },
    blocks_layout: {
      items: [blockToRemoveId1, blockToRemoveId2],
    },
  };

  const mockContentAfterFirstRemoval = {
    ...sampleDocument,
    "@id": `${testBaseUrl}/++api++${testPath}`,
    id: "my-page",
    blocks: {
      [blockToRemoveId2]: { "@type": "text", plaintext: "Block to remove 2" },
    },
    blocks_layout: {
      items: [blockToRemoveId2],
    },
  };

  const mockContentAfterBothRemovals = {
    ...sampleDocument,
    "@id": `${testBaseUrl}/++api++${testPath}`,
    id: "my-page",
    blocks: {},
    blocks_layout: {
      items: [],
    },
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
    vi.spyOn(BlockUtils, "generateBlockId").mockImplementation(
      (() => {
        let i = 0;
        return () => `mock-id-${++i}`;
      })(),
    );
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.restoreAllMocks();
    sessionManager.clearSession(sessionId);
  });

  it("should serialize two concurrent removals on the same path", async () => {
    // First GET returns the initial state; second GET returns the state after
    // the first removal, proving the second operation waited for the first.
    mockServer.mockContentGet(testPath, mockContentWithBothBlocks);
    mockServer.mockContentGet(testPath, mockContentAfterFirstRemoval);

    // First PATCH must only remove block 1; second PATCH must remove block 2
    // from the already-updated state (so neither block remains).
    Nock(testBaseUrl)
      .patch(
        `/++api++${testPath}`,
        (body: { blocks: Record<string, unknown> }) => {
          expect(body.blocks).not.toHaveProperty(blockToRemoveId1);
          expect(body.blocks).toHaveProperty(blockToRemoveId2);
          return true;
        },
      )
      .reply(200, mockContentAfterFirstRemoval);

    Nock(testBaseUrl)
      .patch(
        `/++api++${testPath}`,
        (body: { blocks: Record<string, unknown> }) => {
          expect(body.blocks).not.toHaveProperty(blockToRemoveId1);
          expect(body.blocks).not.toHaveProperty(blockToRemoveId2);
          return true;
        },
      )
      .reply(200, mockContentAfterBothRemovals);

    const promiseA = ploneRemoveSingleBlock.handler(
      { path: testPath, blockId: blockToRemoveId1 },
      mockExtra,
    );
    const promiseB = ploneRemoveSingleBlock.handler(
      { path: testPath, blockId: blockToRemoveId2 },
      mockExtra,
    );

    const [resultA, resultB] = await Promise.all([promiseA, promiseB]);

    expect(JSON.parse(resultA.content[0].text)).toEqual(
      mockContentAfterFirstRemoval,
    );
    expect(JSON.parse(resultB.content[0].text)).toEqual(
      mockContentAfterBothRemovals,
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should serialize two concurrent adds on the same path", async () => {
    const initialBlocks = {
      "block-existing-1": { "@type": "text", plaintext: "Existing block 1" },
    };
    const initialLayout = { items: ["block-existing-1"] };
    const firstAddedContent = {
      ...sampleDocument,
      "@id": `${testBaseUrl}/++api++${testPath}`,
      id: "my-page",
      blocks: {
        ...initialBlocks,
        "mock-id-1": { "@type": "slate", plaintext: "First paragraph" },
      },
      blocks_layout: {
        items: ["block-existing-1", "mock-id-1"],
      },
    };
    const secondAddedContent = {
      ...sampleDocument,
      "@id": `${testBaseUrl}/++api++${testPath}`,
      id: "my-page",
      blocks: {
        ...firstAddedContent.blocks,
        "mock-id-2": { "@type": "slate", plaintext: "Second paragraph" },
      },
      blocks_layout: {
        items: ["block-existing-1", "mock-id-1", "mock-id-2"],
      },
    };

    mockServer.mockContentGet(testPath, {
      ...sampleDocument,
      "@id": `${testBaseUrl}/++api++${testPath}`,
      id: "my-page",
      blocks: initialBlocks,
      blocks_layout: initialLayout,
    });
    mockServer.mockContentGet(testPath, firstAddedContent);

    Nock(testBaseUrl)
      .patch(
        `/++api++${testPath}`,
        (body: {
          blocks: Record<string, unknown>;
          blocks_layout: { items: string[] };
        }) => {
          expect(body.blocks).toHaveProperty("mock-id-1");
          expect(body.blocks_layout.items).toEqual([
            "block-existing-1",
            "mock-id-1",
          ]);
          return true;
        },
      )
      .reply(200, firstAddedContent);

    Nock(testBaseUrl)
      .patch(
        `/++api++${testPath}`,
        (body: {
          blocks: Record<string, unknown>;
          blocks_layout: { items: string[] };
        }) => {
          expect(body.blocks).toHaveProperty("mock-id-1");
          expect(body.blocks).toHaveProperty("mock-id-2");
          expect(body.blocks_layout.items).toEqual([
            "block-existing-1",
            "mock-id-1",
            "mock-id-2",
          ]);
          return true;
        },
      )
      .reply(200, secondAddedContent);

    const promiseA = ploneAddSingleBlock.handler(
      {
        path: testPath,
        blockType: "text",
        blockData: { text: "First paragraph" },
      },
      mockExtra,
    );
    const promiseB = ploneAddSingleBlock.handler(
      {
        path: testPath,
        blockType: "text",
        blockData: { text: "Second paragraph" },
      },
      mockExtra,
    );

    const [resultA, resultB] = await Promise.all([promiseA, promiseB]);

    expect(JSON.parse(resultA.content[0].text)).toEqual(firstAddedContent);
    expect(JSON.parse(resultB.content[0].text)).toEqual(secondAddedContent);
    expect(Nock.isDone()).toBe(true);
  });
});
