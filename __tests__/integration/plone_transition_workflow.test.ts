import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock ,
  PloneMockServer,
  sampleWorkflowInfo,
  createMockContext,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneTransitionWorkflow } from "plone-mcp/tools/plone_transition_workflow";

describe("plone_transition_workflow", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/my-document";
  const transitionName = "publish";

  const mockContext = createMockContext();

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.unstubAllEnvs();
  });

  it("should successfully execute a workflow transition", async () => {
    mockServer.mockWorkflowTransition(
      testPath,
      transitionName,
      sampleWorkflowInfo,
    );

    const args = {
      path: testPath,
      transition: transitionName,
      comment: undefined,
    };
    const result = await ploneTransitionWorkflow.handler(args, mockContext);

    expect(JSON.parse(result.content[0].text)).toEqual(sampleWorkflowInfo);
    expect(Nock.isDone()).toBe(true);
  });

  it("should execute a workflow transition with a comment", async () => {
    const comment = "Publishing for review";
    mockServer.mockWorkflowTransition(
      testPath,
      transitionName,
      sampleWorkflowInfo,
      {
        transition: transitionName,
        comment,
      },
    );

    const args = {
      path: testPath,
      transition: transitionName,
      comment: comment,
    };
    await ploneTransitionWorkflow.handler(args, mockContext);

    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if workflow transition fails", async () => {
    Nock(testBaseUrl, {
      reqheaders: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "user-agent": /.*/,
        "accept-encoding": /.*/,
      },
    })
      .post(`/++api++${testPath}/@workflow/${transitionName}`)
      .reply(400, "Bad Request");

    const args = {
      path: testPath,
      transition: transitionName,
      comment: undefined,
    };
    await expect(ploneTransitionWorkflow.handler(args, mockContext)).rejects.toThrow(
      "[TransitionWorkflow] Request failed with status code 400",
    );
    expect(Nock.isDone()).toBe(true);
  });
});
