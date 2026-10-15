import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock ,
  PloneMockServer,
  sampleDocument,
  createMockContext,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneGetContent } from "plone-mcp/tools/plone_get_content";

describe("plone_get_content", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/test-document";
  const mockContext = createMockContext();
  const defaultReqHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("should successfully retrieve content", async () => {
    mockServer.mockContentGet(testPath, sampleDocument);

    const args = {
      path: testPath,
      expand: undefined,
    };
    const result = await ploneGetContent.handler(args, mockContext);

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
    await ploneGetContent.handler(args, mockContext);

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
    await expect(ploneGetContent.handler(args, mockContext)).rejects.toThrow(
      "[GetContent] Request failed with status code 404",
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("keeps concurrent requests with different credentials apart", async () => {
    for (const token of ["token-a", "token-b"]) {
      Nock(testBaseUrl, { reqheaders: { authorization: `Bearer ${token}` } })
        .get(`/++api++${testPath}`)
        .delay(token === "token-a" ? 20 : 0)
        .reply(200, { ...sampleDocument, title: token });
    }
    const contextFor = (token: string) =>
      createMockContext({
        http: { authInfo: { token, clientId: "plone-mcp", scopes: [] } },
      });

    const [first, second] = await Promise.all([
      ploneGetContent.handler({ path: testPath }, contextFor("token-a")),
      ploneGetContent.handler({ path: testPath }, contextFor("token-b")),
    ]);

    expect(JSON.parse(first.content[0].text).title).toBe("token-a");
    expect(JSON.parse(second.content[0].text).title).toBe("token-b");
    expect(Nock.isDone()).toBe(true);
  });
});
