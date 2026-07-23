import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock } from "plone-mcp/__tests__/utils/test-helpers";
import { ploneUpdateUser } from "plone-mcp/tools/plone_update_user";
import { sessionManager } from "plone-mcp/session-manager";
import { PloneClient } from "plone-mcp/plone-client";

describe("plone_update_user", () => {
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

  it("should successfully update a user", async () => {
    const userid = "jdoe";
    const updateData = {
      fullname: "Jane Doe",
      email: "jane@example.com",
    };

    Nock(testBaseUrl)
      .patch(`/++api++/@users/${userid}`, updateData)
      .reply(204);

    const args = {
      userid,
      ...updateData,
    };
    const result = await ploneUpdateUser.handler(args, mockExtra);

    expect(result.content[0].text).toBe(`Successfully updated user: ${userid}`);
    expect(Nock.isDone()).toBe(true);
  });

  it("should successfully update user roles", async () => {
    const userid = "jdoe";
    const updateData = {
      roles: {
        Contributor: true,
        Editor: false,
      },
    };

    Nock(testBaseUrl)
      .patch(`/++api++/@users/${userid}`, updateData)
      .reply(204);

    const args = {
      userid,
      ...updateData,
    };
    const result = await ploneUpdateUser.handler(args, mockExtra);

    expect(result.content[0].text).toBe(`Successfully updated user: ${userid}`);
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if no changes are specified", async () => {
    const args = {
      userid: "jdoe",
    };
    await expect(ploneUpdateUser.handler(args, mockExtra)).rejects.toThrow(
      "[UpdateUser] No changes specified for update",
    );
  });

  it("should throw an error if user update fails", async () => {
    const userid = "jdoe";
    const updateData = {
      fullname: "Jane Doe",
    };

    Nock(testBaseUrl)
      .patch(`/++api++/@users/${userid}`, updateData)
      .reply(404, { message: "User not found" });

    const args = {
      userid,
      ...updateData,
    };
    await expect(ploneUpdateUser.handler(args, mockExtra)).rejects.toThrow(
      "[UpdateUser] Request failed with status code 404",
    );
    expect(Nock.isDone()).toBe(true);
  });
});
