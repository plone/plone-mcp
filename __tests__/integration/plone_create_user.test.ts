import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock, createMockContext } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneCreateUser } from "plone-mcp/tools/plone_create_user";

describe("plone_create_user", () => {
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

  it("should successfully create a user", async () => {
    const userData = {
      username: "jdoe",
      password: "password123",
      email: "jdoe@example.com",
      fullname: "John Doe",
    };

    const responseData = {
      ...userData,
      "@id": `${testBaseUrl}/++api++/@users/jdoe`,
      id: "jdoe",
    };

    Nock(testBaseUrl)
      .post("/++api++/@users", userData)
      .reply(201, responseData);

    const args = userData;
    const result = await ploneCreateUser.handler(args, mockContext);

    expect(JSON.parse(result.content[0].text)).toEqual(responseData);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if user creation fails", async () => {
    const userData = {
      username: "jdoe",
      password: "password123",
    };

    Nock(testBaseUrl)
      .post("/++api++/@users", userData)
      .reply(400, { message: "Username already exists" });

    const args = userData;
    await expect(ploneCreateUser.handler(args, mockContext)).rejects.toThrow(
      "[CreateUser] Request failed with status code 400",
    );
    expect(Nock.isDone()).toBe(true);
  });
});
