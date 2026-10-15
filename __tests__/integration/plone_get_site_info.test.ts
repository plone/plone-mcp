import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock , PloneMockServer, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneGetSiteInfo } from "plone-mcp/tools/plone_get_site_info";

describe("plone_get_site_info", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const mockSiteInfo = {
    "@id": `${testBaseUrl}/++api++/`,
    id: "plone",
    title: "Test Site",
    language: "en",
  };

  const mockContext = createMockContext();

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.unstubAllEnvs();
  });

  it("should successfully retrieve site information", async () => {
    mockServer.mockSiteRoot(mockSiteInfo);

    const result = await ploneGetSiteInfo.handler({}, mockContext);

    expect(JSON.parse(result.content[0].text)).toEqual(mockSiteInfo);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if site information retrieval fails", async () => {
    Nock(testBaseUrl, {
      // nock.default is implied here if nock is a function
      reqheaders: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "user-agent": /.*/,
        "accept-encoding": /.*/,
      },
    })
      .get("/++api++")
      .reply(500, "Server Error");

    await expect(ploneGetSiteInfo.handler({}, mockContext)).rejects.toThrow(
      "[GetSiteInfo] Request failed with status code 500",
    );
    expect(Nock.isDone()).toBe(true);
  });
});
