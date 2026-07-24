import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneCreateUser } from "plone-mcp/tools/plone_create_user";
import { sessionManager } from "plone-mcp/session-manager";
import { PloneClient } from "plone-mcp/plone-client";

describe("plone_create_user", () => {
  const testBaseUrl = "http://localhost:8080/Plone";
  const sessionId = "test-session-id";
  const mockExtra = {
    sessionId,
    signal: new AbortController().signal,
    requestId: "test-request-id",
  } as any;

  beforeEach(() => {
    const service = sessionManager.getSession(sessionId);
    service.client = new PloneClient({ baseUrl: testBaseUrl });
  });

  afterEach(() => {
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
    const result = await ploneCreateUser.handler(args, mockExtra);

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
    await expect(ploneCreateUser.handler(args, mockExtra)).rejects.toThrow(
      "[CreateUser] Request failed with status code 400",
    );
    expect(Nock.isDone()).toBe(true);
  });
});
