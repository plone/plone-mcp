import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, PloneMockServer, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneMoveContent } from "plone-mcp/tools/plone_move_content";

describe("plone_move_content", () => {
  const testBaseUrl = "http://localhost:8080/Plone";
  const parentPath = "/folder";
  const sourcePath = "/front-page";
  const mockContext = createMockContext();

  beforeEach(() => {
    new PloneMockServer(testBaseUrl);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
  });

  afterEach(() => {
    Nock.cleanAll();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("should move a single source via POST to @move", async () => {
    const response = [
      {
        source: `${testBaseUrl}${sourcePath}`,
        target: `${testBaseUrl}${parentPath}/front-page`,
      },
    ];
    Nock(testBaseUrl)
      .post(`/++api++${parentPath}/@move`, { source: sourcePath })
      .reply(200, response);

    const result = await ploneMoveContent.handler(
      { parentPath, source: sourcePath },
      mockContext,
    );

    expect(JSON.parse(result.content[0].text)).toEqual(response);
    expect(result.content).toHaveLength(1);
    expect(Nock.isDone()).toBe(true);
  });

  it("should move into the site root (parentPath: '/')", async () => {
    const response = [
      {
        source: `${testBaseUrl}${sourcePath}`,
        target: `${testBaseUrl}/front-page`,
      },
    ];
    Nock(testBaseUrl)
      .post(`/++api++/@move`, { source: sourcePath })
      .reply(200, response);

    const result = await ploneMoveContent.handler(
      { parentPath: "/", source: sourcePath },
      mockContext,
    );

    expect(JSON.parse(result.content[0].text)).toEqual(response);
    expect(Nock.isDone()).toBe(true);
  });

  it("should move multiple sources given as an array", async () => {
    const sources = ["/front-page", "/newsitem"];
    const response = [
      {
        source: `${testBaseUrl}/front-page`,
        target: `${testBaseUrl}${parentPath}/front-page`,
      },
      {
        source: `${testBaseUrl}/newsitem`,
        target: `${testBaseUrl}${parentPath}/newsitem`,
      },
    ];
    Nock(testBaseUrl)
      .post(`/++api++${parentPath}/@move`, { source: sources })
      .reply(200, response);

    const result = await ploneMoveContent.handler(
      { parentPath, source: sources },
      mockContext,
    );

    expect(JSON.parse(result.content[0].text)).toHaveLength(2);
    expect(result.content).toHaveLength(1);
    expect(Nock.isDone()).toBe(true);
  });

  it("should warn when the API drops unresolved sources", async () => {
    const sources = ["/front-page", "/does-not-exist"];
    const response = [
      {
        source: `${testBaseUrl}/front-page`,
        target: `${testBaseUrl}${parentPath}/front-page`,
      },
    ];
    Nock(testBaseUrl)
      .post(`/++api++${parentPath}/@move`, { source: sources })
      .reply(200, response);

    const result = await ploneMoveContent.handler(
      { parentPath, source: sources },
      mockContext,
    );

    expect(result.content).toHaveLength(2);
    expect(result.content[1].text).toContain("1 of 2 source(s)");
    expect(Nock.isDone()).toBe(true);
  });

  it("should surface forbidden errors for locked or protected sources", async () => {
    Nock(testBaseUrl)
      .post(`/++api++${parentPath}/@move`)
      .reply(403, "Forbidden");

    await expect(
      ploneMoveContent.handler({ parentPath, source: sourcePath }, mockContext),
    ).rejects.toThrow("[MoveContent] Request failed with status code 403");
    expect(Nock.isDone()).toBe(true);
  });
});
