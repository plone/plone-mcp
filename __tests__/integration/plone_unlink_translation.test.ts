import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, PloneMockServer } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneUnlinkTranslation } from "plone-mcp/tools/plone_unlink_translation";
import { sessionManager } from "plone-mcp/session-manager";
import { PloneClient } from "plone-mcp/plone-client";

describe("plone_unlink_translation", () => {
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/en/my-page";
  const language = "de";
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

  it("should unlink a translation via DELETE to @translations", async () => {
    Nock(testBaseUrl)
      .delete(`/++api++${testPath}/@translations`, { language })
      .reply(204);

    const result = await ploneUnlinkTranslation.handler(
      { path: testPath, language },
      mockExtra,
    );

    expect(result.content[0].text).toContain(
      `Successfully unlinked '${language}' translation from '${testPath}'.`,
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if the Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    await expect(
      ploneUnlinkTranslation.handler({ path: testPath, language }, mockExtra),
    ).rejects.toThrow("Plone client not configured. Please run plone_configure first.");
    expect(Nock.pendingMocks()).toHaveLength(0);
  });
});
