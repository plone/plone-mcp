import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock ,
  PloneMockServer,
  sampleWorkflowInfo,
  createMockContext,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneGetWorkflowInfo } from "plone-mcp/tools/plone_get_workflow_info";

describe("plone_get_workflow_info", () => {
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

  it("should successfully retrieve workflow information", async () => {
    mockServer.mockWorkflow(testPath, sampleWorkflowInfo);

    const args = { path: testPath };
    const result = await ploneGetWorkflowInfo.handler(args, mockContext);

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
    await expect(ploneGetWorkflowInfo.handler(args, mockContext)).rejects.toThrow(
      "[GetWorkflowInfo] Request failed with status code 404",
    );
    expect(Nock.isDone()).toBe(true);
  });
});
