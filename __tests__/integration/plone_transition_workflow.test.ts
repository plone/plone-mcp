import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Nock ,
  PloneMockServer,
  sampleWorkflowInfo,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneTransitionWorkflow } from "plone-mcp/tools/plone_transition_workflow";
import { PloneClient } from "plone-mcp/plone-client";
import { sessionManager } from "plone-mcp/session-manager";

describe("plone_transition_workflow", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/my-document";
  const transitionName = "publish";

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
    const result = await ploneTransitionWorkflow.handler(args, mockExtra);

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
    await ploneTransitionWorkflow.handler(args, mockExtra);

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
    await expect(ploneTransitionWorkflow.handler(args, mockExtra)).rejects.toThrow(
      "[TransitionWorkflow] Request failed with status code 400",
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    const args = {
      path: testPath,
      transition: transitionName,
      comment: undefined,
    };
    await expect(ploneTransitionWorkflow.handler(args, mockExtra)).rejects.toThrow(
      "Plone client not configured. Please run plone_configure first.",
    );
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });
});
