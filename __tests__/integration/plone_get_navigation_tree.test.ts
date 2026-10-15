import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneGetNavigationTree } from "plone-mcp/tools/plone_get_navigation_tree";

describe("plone_get_navigation_tree", () => {
  const testBaseUrl = "http://localhost:8080/Plone";
  const mockNavigationTree = [
    {
      "@id": `${testBaseUrl}/++api++/front-page`,
      title: "Front Page",
      items: [],
    },
    {
      "@id": `${testBaseUrl}/++api++/news`,
      title: "News",
      items: [
        {
          "@id": `${testBaseUrl}/++api++/news/article-1`,
          title: "Article 1",
          items: [],
        },
      ],
    },
  ];

  const mockContext = createMockContext();

  beforeEach(() => {
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.unstubAllEnvs();
  });

  it("should successfully retrieve navigation tree from root with default depth", async () => {
    Nock(testBaseUrl)
      .get("/++api++/@navigation")
      .query({ "expand.navigation.depth": 2 })
      .reply(200, mockNavigationTree);

    const args = { root_path: undefined, depth: 2 }; // Explicitly set depth to its default
    const result = await ploneGetNavigationTree.handler(args, mockContext);

    expect(JSON.parse(result.content[0].text)).toEqual(mockNavigationTree);
    expect(Nock.isDone()).toBe(true);
  });

  it("should successfully retrieve navigation tree from a specific path with custom depth", async () => {
    const customPath = "/some/path";
    const customDepth = 3;
    Nock(testBaseUrl)
      .get(`/++api++${customPath}/@navigation`)
      .query({ "expand.navigation.depth": customDepth })
      .reply(200, mockNavigationTree);

    const args = {
      root_path: customPath,
      depth: customDepth,
    };
    const result = await ploneGetNavigationTree.handler(args, mockContext);

    expect(JSON.parse(result.content[0].text)).toEqual(mockNavigationTree);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if navigation tree retrieval fails", async () => {
    const customPath = "/non-existent";
    Nock(testBaseUrl)
      .get(`/++api++${customPath}/@navigation`)
      .query({ "expand.navigation.depth": 2 })
      .reply(500, "Server Error");

    const args = {
      root_path: customPath,
      depth: 2,
    }; // Explicitly set depth to its default
    await expect(ploneGetNavigationTree.handler(args, mockContext)).rejects.toThrow(
      "[GetNavigationTree] Request failed with status code 500",
    );
    expect(Nock.isDone()).toBe(true);
  });
});
