import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Nock, PloneMockServer } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneCreateWorkingCopy } from "plone-mcp/tools/plone_create_working_copy";
import { PloneClient } from "plone-mcp/plone-client";
import { sessionManager } from "plone-mcp/session-manager";

describe("plone_create_working_copy", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/my-document";

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

  it("should check out the content and return the working copy id", async () => {
    const response = {
      "@id": "http://localhost:8080/Plone/copy_of_my-document",
    };
    mockServer.mockWorkingCopyCreate(testPath, response);

    const result = await ploneCreateWorkingCopy.handler(
      { path: testPath },
      mockExtra,
    );

    expect(JSON.parse(result.content[0].text)).toEqual(response);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if the checkout fails", async () => {
    Nock(testBaseUrl)
      .post(`/++api++${testPath}/@workingcopy`)
      .reply(400, "Bad Request");

    await expect(
      ploneCreateWorkingCopy.handler({ path: testPath }, mockExtra),
    ).rejects.toThrow("[CreateWorkingCopy] Request failed with status code 400");
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    await expect(
      ploneCreateWorkingCopy.handler({ path: testPath }, mockExtra),
    ).rejects.toThrow("Plone client not configured. Please run plone_configure first.");
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });
});
