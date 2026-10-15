import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  Nock,
  PloneMockServer,
  sampleLockInfo,
  sampleWorkingCopyInfo,
  createMockContext,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneGetWorkingCopy } from "plone-mcp/tools/plone_get_working_copy";

describe("plone_get_working_copy", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/my-document";

  const mockContext = createMockContext();

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.unstubAllEnvs();
  });

  it("should return the working copy relationship merged with the lock state", async () => {
    mockServer.mockWorkingCopyGet(testPath, sampleWorkingCopyInfo);
    mockServer.mockLockGet(testPath, sampleLockInfo);

    const result = await ploneGetWorkingCopy.handler(
      { path: testPath },
      mockContext,
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
      mockContext,
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
      ploneGetWorkingCopy.handler({ path: testPath }, mockContext),
    ).rejects.toThrow("[GetWorkingCopy] Request failed with status code 400");
  });
});
