import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, PloneMockServer } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneLinkTranslation } from "plone-mcp/tools/plone_link_translation";
import { sessionManager } from "plone-mcp/session-manager";
import { PloneClient } from "plone-mcp/plone-client";

describe("plone_link_translation", () => {
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/en/my-page";
  const targetId = "/de/meine-seite";
  const sessionId = "test-session-id";
  const mockExtra = {
    sessionId,
    signal: new AbortController().signal,
    requestId: "test-request-id",
  } as any;

  beforeEach(() => {
    new PloneMockServer(testBaseUrl);
    const service = sessionManager.getSession(sessionId);
    service.client = new PloneClient({ baseUrl: testBaseUrl });
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.clearAllMocks();
  });

  it("should link a translation via POST to @translations", async () => {
    Nock(testBaseUrl)
      .post(`/++api++${testPath}/@translations`, { id: targetId })
      .reply(201, { "@id": `${testBaseUrl}${targetId}` });

    const result = await ploneLinkTranslation.handler(
      { path: testPath, id: targetId },
      mockExtra,
    );

    expect(result.content[0].text).toContain(targetId);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if the Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    await expect(
      ploneLinkTranslation.handler({ path: testPath, id: targetId }, mockExtra),
    ).rejects.toThrow("Plone client not configured. Please run plone_configure first.");
    expect(Nock.pendingMocks()).toHaveLength(0);
  });
});
