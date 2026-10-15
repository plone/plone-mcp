import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock , PloneMockServer, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneDeleteContent } from "plone-mcp/tools/plone_delete_content";

describe("plone_delete_content", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/my-old-page";
  const mockContext = createMockContext();

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("should successfully delete content", async () => {
    mockServer.mockContentDelete(testPath);

    const args = { path: testPath };
    const result = await ploneDeleteContent.handler(args, mockContext);

    expect(result.content[0].text).toContain(
      `Successfully deleted content at path: ${testPath}`,
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if content deletion fails (e.g., 404 Not Found)", async () => {
    Nock(testBaseUrl, {
      reqheaders: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "user-agent": /.*/,
        "accept-encoding": /.*/,
      },
    })
      .delete(`/++api++${testPath}`)
      .reply(404, "Not Found");

    const args = { path: testPath };
    await expect(ploneDeleteContent.handler(args, mockContext)).rejects.toThrow(
      "[DeleteContent] Request failed with status code 404",
    );
    expect(Nock.isDone()).toBe(true);
  });
});
