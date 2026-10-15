import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock , PloneMockServer, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneGetTypes } from "plone-mcp/tools/plone_get_types";

describe("plone_get_types", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";
  const mockTypes = {
    Document: { title: "Page" },
    NewsItem: { title: "News Item" },
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

  it("should successfully retrieve content types", async () => {
    mockServer.mockTypes(mockTypes);

    const result = await ploneGetTypes.handler({}, mockContext);

    expect(JSON.parse(result.content[0].text)).toEqual(mockTypes);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if content types retrieval fails", async () => {
    Nock(testBaseUrl, {
      reqheaders: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "user-agent": /.*/,
        "accept-encoding": /.*/,
      },
    })
      .get("/++api++/@types")
      .reply(500, "Server Error");

    await expect(ploneGetTypes.handler({}, mockContext)).rejects.toThrow(
      "[GetTypes] Request failed with status code 500",
    );
    expect(Nock.isDone()).toBe(true);
  });
});
