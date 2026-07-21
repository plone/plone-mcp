import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock ,
  PloneMockServer,
  sampleDocument,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneGetContent } from "plone-mcp/tools/plone_get_content";
import { sessionManager } from "plone-mcp/session-manager";
import { PloneClient } from "plone-mcp/plone-client";

describe("plone_get_content", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/test-document";
  const sessionId = "test-session-id";
  const mockExtra = {
    sessionId,
    signal: new AbortController().signal,
    requestId: "test-request-id",
  } as any;
  const defaultReqHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);
    const service = sessionManager.getSession(sessionId);
    service.client = new PloneClient({ baseUrl: testBaseUrl });
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.restoreAllMocks();
  });

  it("should successfully retrieve content", async () => {
    mockServer.mockContentGet(testPath, sampleDocument);

    const args = {
      path: testPath,
      expand: undefined,
    };
    const result = await ploneGetContent.handler(args, mockExtra);

    expect(JSON.parse(result.content[0].text)).toEqual(sampleDocument);
    expect(Nock.isDone()).toBe(true);
  });

  it("should retrieve content with expand parameters", async () => {
    const expandParams = ["breadcrumbs", "workflow"];
    Nock(testBaseUrl)
      .get(`/++api++${testPath}`)
      .query({
        expand: expandParams.join(","),
      })
      .reply(200, sampleDocument);

    const args = {
      path: testPath,
      expand: expandParams,
    };
    await ploneGetContent.handler(args, mockExtra);

    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if content retrieval fails (e.g., 404 Not Found)", async () => {
    Nock(testBaseUrl, { reqheaders: defaultReqHeaders })
      .get(`/++api++${testPath}`)
      .reply(404, "Not Found");

    const args = {
      path: testPath,
      expand: undefined,
    };
    await expect(ploneGetContent.handler(args, mockExtra)).rejects.toThrow(
      "[GetContent] Request failed with status code 404",
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    const args = {
      path: testPath,
      expand: undefined,
    };
    await expect(ploneGetContent.handler(args, mockExtra)).rejects.toThrow(
      "Plone client not configured. Please run plone_configure first.",
    );
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });
});
