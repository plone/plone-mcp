import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock , PloneMockServer, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneDeleteContent } from "plone-mcp/tools/plone_delete_content";
import { sessionManager } from "plone-mcp/session-manager";
import { PloneClient } from "plone-mcp/plone-client";

describe("plone_delete_content", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/my-old-page";
  const sessionId = "test-session-id";
  const mockContext = createMockContext({ sessionId });

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);
    const service = sessionManager.getSession(sessionId);
    service.client = new PloneClient({ baseUrl: testBaseUrl });
  });

  afterEach(() => {
    Nock.cleanAll();
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

  it("should throw an error if Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    const args = { path: testPath };
    await expect(ploneDeleteContent.handler(args, mockContext)).rejects.toThrow(
      "Plone client not configured. Please run plone_configure first.",
    );
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });
});
