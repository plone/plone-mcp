import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Nock, PloneMockServer } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneCheckinWorkingCopy } from "plone-mcp/tools/plone_checkin_working_copy";
import { PloneClient } from "plone-mcp/plone-client";
import { sessionManager } from "plone-mcp/session-manager";

describe("plone_checkin_working_copy", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/copy_of_my-document";

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

  it("should check in the working copy", async () => {
    mockServer.mockWorkingCopyCheckin(testPath);

    const result = await ploneCheckinWorkingCopy.handler(
      { path: testPath },
      mockExtra,
    );

    expect(result.content[0].text).toBe(
      `Successfully checked in working copy for '${testPath}'. The working copy has been deleted and the original unlocked.`,
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should check in when given the original's path", async () => {
    const originalPath = "/my-document";
    mockServer.mockWorkingCopyCheckin(originalPath);

    await ploneCheckinWorkingCopy.handler({ path: originalPath }, mockExtra);

    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if the check-in fails", async () => {
    Nock(testBaseUrl)
      .patch(`/++api++${testPath}/@workingcopy`)
      .reply(400, "Bad Request");

    await expect(
      ploneCheckinWorkingCopy.handler({ path: testPath }, mockExtra),
    ).rejects.toThrow(
      "[CheckinWorkingCopy] Request failed with status code 400",
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    await expect(
      ploneCheckinWorkingCopy.handler({ path: testPath }, mockExtra),
    ).rejects.toThrow("Plone client not configured. Please run plone_configure first.");
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });
});
