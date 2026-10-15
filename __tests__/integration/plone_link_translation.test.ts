import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, PloneMockServer, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneLinkTranslation } from "plone-mcp/tools/plone_link_translation";

describe("plone_link_translation", () => {
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/en/my-page";
  const targetId = "/de/meine-seite";
  const mockContext = createMockContext();

  beforeEach(() => {
    new PloneMockServer(testBaseUrl);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Nock.cleanAll();
    vi.clearAllMocks();
  });

  it("should link a translation via POST to @translations", async () => {
    Nock(testBaseUrl)
      .post(`/++api++${testPath}/@translations`, { id: targetId })
      .reply(201, { "@id": `${testBaseUrl}${targetId}` });

    const result = await ploneLinkTranslation.handler(
      { path: testPath, id: targetId },
      mockContext,
    );

    expect(result.content[0].text).toContain(targetId);
    expect(Nock.isDone()).toBe(true);
  });
});
