import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, PloneMockServer } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneGetTranslation } from "plone-mcp/tools/plone_get_translation";
import { sessionManager } from "plone-mcp/session-manager";
import { PloneClient } from "plone-mcp/plone-client";

describe("plone_get_translation", () => {
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/en/my-page";
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

  it("should return the translations of a content item", async () => {
    const response = { items: [{ "@id": `${testBaseUrl}/de/meine-seite`, language: "de" }] };
    Nock(testBaseUrl)
      .get(`/++api++${testPath}/@translations`)
      .reply(200, response);

    const result = await ploneGetTranslation.handler({ path: testPath }, mockExtra);

    expect(result.content[0].text).toContain('"language": "de"');
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if the Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    await expect(
      ploneGetTranslation.handler({ path: testPath }, mockExtra),
    ).rejects.toThrow("Plone client not configured. Please run plone_configure first.");
    expect(Nock.pendingMocks()).toHaveLength(0);
  });
});
