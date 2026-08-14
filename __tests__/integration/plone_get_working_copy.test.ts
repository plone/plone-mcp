import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  Nock,
  PloneMockServer,
  sampleLockInfo,
  sampleWorkingCopyInfo,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneGetWorkingCopy } from "plone-mcp/tools/plone_get_working_copy";
import { PloneClient } from "plone-mcp/plone-client";
import { sessionManager } from "plone-mcp/session-manager";

describe("plone_get_working_copy", () => {
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

  it("should return the working copy relationship merged with the lock state", async () => {
    mockServer.mockWorkingCopyGet(testPath, sampleWorkingCopyInfo);
    mockServer.mockLockGet(testPath, sampleLockInfo);

    const result = await ploneGetWorkingCopy.handler(
      { path: testPath },
      mockExtra,
    );

    expect(JSON.parse(result.content[0].text)).toEqual({
      ...sampleWorkingCopyInfo,
      lock: sampleLockInfo,
    });
    expect(Nock.isDone()).toBe(true);
  });

  it("should report an unlocked item without a working copy", async () => {
    mockServer.mockWorkingCopyGet(testPath, {
      working_copy: null,
      working_copy_of: null,
    });
    mockServer.mockLockGet(testPath, { locked: false, stealable: true });

    const result = await ploneGetWorkingCopy.handler(
      { path: testPath },
      mockExtra,
    );

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.working_copy).toBeNull();
    expect(parsed.lock.locked).toBe(false);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if the request fails", async () => {
    Nock(testBaseUrl)
      .get(`/++api++${testPath}/@workingcopy`)
      .reply(400, "Bad Request");
    Nock(testBaseUrl)
      .get(`/++api++${testPath}/@lock`)
      .reply(200, { locked: false });

    await expect(
      ploneGetWorkingCopy.handler({ path: testPath }, mockExtra),
    ).rejects.toThrow("[GetWorkingCopy] Request failed with status code 400");
  });

  it("should throw an error if Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    await expect(
      ploneGetWorkingCopy.handler({ path: testPath }, mockExtra),
    ).rejects.toThrow("Plone client not configured. Please run plone_configure first.");
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });
});
