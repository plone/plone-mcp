import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, PloneMockServer, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneUnlinkTranslation } from "plone-mcp/tools/plone_unlink_translation";

describe("plone_unlink_translation", () => {
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/en/my-page";
  const language = "de";
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

  it("should unlink a translation via DELETE to @translations", async () => {
    Nock(testBaseUrl)
      .delete(`/++api++${testPath}/@translations`, { language })
      .reply(204);

    const result = await ploneUnlinkTranslation.handler(
      { path: testPath, language },
      mockContext,
    );

    expect(result.content[0].text).toContain(
      `Successfully unlinked '${language}' translation from '${testPath}'.`,
    );
    expect(Nock.isDone()).toBe(true);
  });
});
