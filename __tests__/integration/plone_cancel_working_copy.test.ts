import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, PloneMockServer, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneCancelWorkingCopy } from "plone-mcp/tools/plone_cancel_working_copy";

describe("plone_cancel_working_copy", () => {
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

  it("should cancel the checkout", async () => {
    mockServer.mockWorkingCopyCancel(testPath);

    const result = await ploneCancelWorkingCopy.handler(
      { path: testPath },
      mockContext,
    );

    expect(result.content[0].text).toBe(
      `Successfully cancelled the working copy for '${testPath}'. The working copy has been discarded and the original unlocked.`,
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should cancel when given the original's path", async () => {
    const originalPath = "/my-document";
    mockServer.mockWorkingCopyCancel(originalPath);

    await ploneCancelWorkingCopy.handler({ path: originalPath }, mockContext);

    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if the cancellation fails", async () => {
    Nock(testBaseUrl)
      .delete(`/++api++${testPath}/@workingcopy`)
      .reply(400, "Bad Request");

    await expect(
      ploneCancelWorkingCopy.handler({ path: testPath }, mockContext),
    ).rejects.toThrow("[CancelWorkingCopy] Request failed with status code 400");
    expect(Nock.isDone()).toBe(true);
  });
});
