import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Nock ,
  PloneMockServer,
  sampleWorkflowInfo,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneGetWorkflowInfo } from "plone-mcp/tools/plone_get_workflow_info";
import { PloneClient } from "plone-mcp/plone-client";
import { sessionManager } from "plone-mcp/session-manager";

describe("plone_get_workflow_info", () => {
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

  it("should successfully retrieve workflow information", async () => {
    mockServer.mockWorkflow(testPath, sampleWorkflowInfo);

    const args = { path: testPath };
    const result = await ploneGetWorkflowInfo.handler(args, mockExtra);

    expect(JSON.parse(result.content[0].text)).toEqual(sampleWorkflowInfo);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if workflow information retrieval fails", async () => {
    Nock(testBaseUrl, {
      reqheaders: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "user-agent": /.*/,
        "accept-encoding": /.*/,
      },
    })
      .get(`/++api++${testPath}/@workflow`)
      .reply(404, "Not Found");

    const args = { path: testPath };
    await expect(ploneGetWorkflowInfo.handler(args, mockExtra)).rejects.toThrow(
      "[GetWorkflowInfo] Request failed with status code 404",
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    const args = { path: testPath };
    await expect(ploneGetWorkflowInfo.handler(args, mockExtra)).rejects.toThrow(
      "Plone client not configured. Please run plone_configure first.",
    );
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });
});
