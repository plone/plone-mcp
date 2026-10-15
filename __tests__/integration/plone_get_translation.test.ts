import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, PloneMockServer, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneGetTranslation } from "plone-mcp/tools/plone_get_translation";

describe("plone_get_translation", () => {
  const testBaseUrl = "http://localhost:8080/Plone";
  const testPath = "/en/my-page";
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

  it("should return the translations of a content item", async () => {
    const response = { items: [{ "@id": `${testBaseUrl}/de/meine-seite`, language: "de" }] };
    Nock(testBaseUrl)
      .get(`/++api++${testPath}/@translations`)
      .reply(200, response);

    const result = await ploneGetTranslation.handler({ path: testPath }, mockContext);

    expect(result.content[0].text).toContain('"language": "de"');
    expect(Nock.isDone()).toBe(true);
  });
});
