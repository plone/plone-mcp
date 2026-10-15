import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, PloneMockServer, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneCopyContent } from "plone-mcp/tools/plone_copy_content";

describe("plone_copy_content", () => {
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

  it("should copy a single source via POST to @copy", async () => {
    const response = [
      {
        source: `${testBaseUrl}${sourcePath}`,
        target: `${testBaseUrl}${parentPath}/copy_of_front-page`,
      },
    ];
    Nock(testBaseUrl)
      .post(`/++api++${parentPath}/@copy`, { source: sourcePath })
      .reply(200, response);

    const result = await ploneCopyContent.handler(
      { parentPath, source: sourcePath },
      mockContext,
    );

    expect(JSON.parse(result.content[0].text)).toEqual(response);
    expect(result.content).toHaveLength(1);
    expect(Nock.isDone()).toBe(true);
  });

  it("should copy into the site root (parentPath: '/')", async () => {
    const response = [
      {
        source: `${testBaseUrl}${sourcePath}`,
        target: `${testBaseUrl}/copy_of_front-page`,
      },
    ];
    Nock(testBaseUrl)
      .post(`/++api++/@copy`, { source: sourcePath })
      .reply(200, response);

    const result = await ploneCopyContent.handler(
      { parentPath: "/", source: sourcePath },
      mockContext,
    );

    expect(JSON.parse(result.content[0].text)).toEqual(response);
    expect(Nock.isDone()).toBe(true);
  });

  it("should copy multiple sources given as an array", async () => {
    const sources = ["/front-page", "/newsitem"];
    const response = [
      {
        source: `${testBaseUrl}/front-page`,
        target: `${testBaseUrl}${parentPath}/copy_of_front-page`,
      },
      {
        source: `${testBaseUrl}/newsitem`,
        target: `${testBaseUrl}${parentPath}/copy_of_newsitem`,
      },
    ];
    Nock(testBaseUrl)
      .post(`/++api++${parentPath}/@copy`, { source: sources })
      .reply(200, response);

    const result = await ploneCopyContent.handler(
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
        target: `${testBaseUrl}${parentPath}/copy_of_front-page`,
      },
    ];
    Nock(testBaseUrl)
      .post(`/++api++${parentPath}/@copy`, { source: sources })
      .reply(200, response);

    const result = await ploneCopyContent.handler(
      { parentPath, source: sources },
      mockContext,
    );

    expect(result.content).toHaveLength(2);
    expect(result.content[1].text).toContain("1 of 2 source(s)");
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if the copy fails", async () => {
    Nock(testBaseUrl)
      .post(`/++api++${parentPath}/@copy`)
      .reply(400, "Bad Request");

    await expect(
      ploneCopyContent.handler({ parentPath, source: sourcePath }, mockContext),
    ).rejects.toThrow("[CopyContent] Request failed with status code 400");
    expect(Nock.isDone()).toBe(true);
  });
});
