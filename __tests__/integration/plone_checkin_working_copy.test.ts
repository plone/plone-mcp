import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, PloneMockServer, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneCheckinWorkingCopy } from "plone-mcp/tools/plone_checkin_working_copy";

describe("plone_checkin_working_copy", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/working_copy_of_my-document";

  const mockContext = createMockContext();

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.unstubAllEnvs();
  });

  it("should check in the working copy", async () => {
    mockServer.mockWorkingCopyCheckin(testPath);

    const result = await ploneCheckinWorkingCopy.handler(
      { path: testPath },
      mockContext,
    );

    expect(result.content[0].text).toBe(
      `Successfully checked in working copy for '${testPath}'. The working copy has been deleted and the original unlocked.`,
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should check in when given the original's path", async () => {
    const originalPath = "/my-document";
    mockServer.mockWorkingCopyCheckin(originalPath);

    await ploneCheckinWorkingCopy.handler({ path: originalPath }, mockContext);

    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if the check-in fails", async () => {
    Nock(testBaseUrl)
      .patch(`/++api++${testPath}/@workingcopy`)
      .reply(400, "Bad Request");

    await expect(
      ploneCheckinWorkingCopy.handler({ path: testPath }, mockContext),
    ).rejects.toThrow(
      "[CheckinWorkingCopy] Request failed with status code 400",
    );
    expect(Nock.isDone()).toBe(true);
  });
});
