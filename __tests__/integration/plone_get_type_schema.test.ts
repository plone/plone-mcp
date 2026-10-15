import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneGetTypeSchema } from "plone-mcp/tools/plone_get_type_schema";

describe("plone_get_type_schema", () => {
  const testBaseUrl = "http://localhost:8080/Plone";
  const mockContext = createMockContext();

  beforeEach(() => {
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Nock.cleanAll();
    vi.restoreAllMocks();
  });

  it("should successfully retrieve content type schema", async () => {
    const contentType = "Document";
    const typeSchema = {
      title: "Document",
      properties: {
        title: { title: "Title", type: "string" },
      },
    };

    Nock(testBaseUrl)
      .get(`/++api++/@types/${contentType}`)
      .reply(200, typeSchema);

    const args = {
      contentType,
    };
    const result = await ploneGetTypeSchema.handler(args, mockContext);

    expect(JSON.parse(result.content[0].text)).toEqual(typeSchema);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if content type schema retrieval fails", async () => {
    const contentType = "UnknownType";

    Nock(testBaseUrl)
      .get(`/++api++/@types/${contentType}`)
      .reply(404, { message: "Type not found" });

    const args = {
      contentType,
    };
    await expect(ploneGetTypeSchema.handler(args, mockContext)).rejects.toThrow(
      "[GetTypeSchema] Request failed with status code 404",
    );
    expect(Nock.isDone()).toBe(true);
  });
});
