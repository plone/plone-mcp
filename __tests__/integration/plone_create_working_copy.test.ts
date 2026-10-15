import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, PloneMockServer, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneCreateWorkingCopy } from "plone-mcp/tools/plone_create_working_copy";

describe("plone_create_working_copy", () => {
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

  it("should check out the content and return the working copy id", async () => {
    const response = {
      "@id": "http://localhost:8080/Plone/working_copy_of_my-document",
    };
    mockServer.mockWorkingCopyCreate(testPath, response);

    const result = await ploneCreateWorkingCopy.handler(
      { path: testPath },
      mockContext,
    );

    expect(JSON.parse(result.content[0].text)).toEqual(response);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if the checkout fails", async () => {
    Nock(testBaseUrl)
      .post(`/++api++${testPath}/@workingcopy`)
      .reply(400, "Bad Request");

    await expect(
      ploneCreateWorkingCopy.handler({ path: testPath }, mockContext),
    ).rejects.toThrow("[CreateWorkingCopy] Request failed with status code 400");
    expect(Nock.isDone()).toBe(true);
  });
});
