import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock } from "plone-mcp/__tests__/utils/test-helpers"; // Use Nock from test-helpers
import { ploneConfigure } from "plone-mcp/tools/plone_configure";
import { sessionManager } from "plone-mcp/session-manager";
import { PloneClient } from "plone-mcp/plone-client"; // Import PloneClient to check its instance

describe("plone_configure", () => {
  const testBaseUrl = "http://localhost:8080/Plone";
  const sessionId = "test-session-id";
  const mockExtra = {
    sessionId,
    signal: new AbortController().signal,
    requestId: "test-request-id",
  } as any;
  const mockSiteRootResponse = {
    "@type": "Plone Site",
    id: "plone",
    title: "Test Site",
  };

  beforeEach(() => {
    // Ensure the session client is null before each test
    const service = sessionManager.getSession(sessionId);
    service.client = null;
  });

  afterEach(() => {
    Nock.cleanAll(); // Use Nock.cleanAll()
    vi.restoreAllMocks();
  });

  it("should successfully configure the Plone client with valid credentials", async () => {
    Nock(testBaseUrl, {
      reqheaders: {
        authorization: "Basic YWRtaW46YWRtaW4=",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })
      .get("/++api++")
      .reply(200, mockSiteRootResponse);

    const args = {
      baseUrl: testBaseUrl,
      username: "admin",
      password: "admin",
    };

    const result = await ploneConfigure.handler(args, mockExtra);

    expect(result.content[0].text).toEqual(
      `Successfully configured connection to Plone site: ${testBaseUrl}`,
    );
    const service = sessionManager.getSession(sessionId);
    expect(service.client).toBeInstanceOf(PloneClient);
    expect(service.client?.baseUrl).toBe(testBaseUrl);
    expect(Nock.isDone()).toBe(true); // Use Nock.isDone()
  });

  it("should successfully configure the Plone client with a token", async () => {
    Nock(testBaseUrl, {
      reqheaders: {
        authorization: "Bearer test-token",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })
      .get("/++api++")
      .reply(200, mockSiteRootResponse);

    const args = {
      baseUrl: testBaseUrl,
      token: "test-token",
    };

    const result = await ploneConfigure.handler(args, mockExtra);

    expect(result.content[0].text).toEqual(
      `Successfully configured connection to Plone site: ${testBaseUrl}`,
    );
    const service = sessionManager.getSession(sessionId);
    expect(service.client).toBeInstanceOf(PloneClient);
    expect(service.client?.token).toBe("test-token");
    expect(Nock.isDone()).toBe(true); // Use Nock.isDone()
  });

  it("should throw an error if configuration fails (e.g., unauthorized)", async () => {
    Nock(testBaseUrl, {
      reqheaders: {
        authorization: "Basic YmFkdXNlcjpiYWRwYXNzd29yZA==",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })
      .get("/++api++")
      .reply(401, { error: "Unauthorized" });

    const args = {
      baseUrl: testBaseUrl,
      username: "baduser",
      password: "badpassword",
    };

    await expect(
      ploneConfigure.handler(args, mockExtra),
    ).rejects.toThrow("[Configure] Request failed with status code 401");
    const service = sessionManager.getSession(sessionId);
    expect(service.client).toBeNull(); // Client should not be set on failure
    expect(Nock.isDone()).toBe(true); // Use Nock.isDone()
  });

  it("should throw an error if baseUrl is invalid", async () => {
    const args = {
      baseUrl: "invalid-url",
      username: "admin",
      password: "admin",
    };

    await expect(
      ploneConfigure.handler(args, mockExtra),
    ).rejects.toThrow("[Configure] Invalid base URL: invalid-url");
    const service = sessionManager.getSession(sessionId);
    expect(service.client).toBeNull();
    expect(Nock.pendingMocks()).toHaveLength(0); // Use Nock.pendingMocks()
  });

  it("should prioritize arguments over environment variables", async () => {
    process.env.PLONE_BASE_URL = "http://env.plone.com";
    process.env.PLONE_USERNAME = "envuser";
    process.env.PLONE_PASSWORD = "envpass";

    Nock(testBaseUrl, {
      reqheaders: {
        authorization: "Basic YXJndXNlcjphcmdwYXNz",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })
      .get("/++api++")
      .reply(200, mockSiteRootResponse);

    const args = {
      baseUrl: testBaseUrl,
      username: "arguser",
      password: "argpass",
    };

    const result = await ploneConfigure.handler(args, mockExtra);

    expect(result.content[0].text).toEqual(
      `Successfully configured connection to Plone site: ${testBaseUrl}`,
    );
    const service = sessionManager.getSession(sessionId);
    expect(service.client?.baseUrl).toBe(testBaseUrl);
    // Cleanup env vars
    delete process.env.PLONE_BASE_URL;
    delete process.env.PLONE_USERNAME;
    delete process.env.PLONE_PASSWORD;
    expect(Nock.isDone()).toBe(true); // Use Nock.isDone()
  });

  it("should use environment variables if arguments are empty", async () => {
    process.env.PLONE_BASE_URL = "http://env.plone.com";
    process.env.PLONE_USERNAME = "envuser";
    process.env.PLONE_PASSWORD = "envpass";

    Nock(process.env.PLONE_BASE_URL, {
      reqheaders: {
        authorization: "Basic ZW52dXNlcjplbnZwYXNz",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })
      .get("/++api++")
      .reply(200, mockSiteRootResponse);

    const args = {
      baseUrl: undefined,
      username: undefined,
      password: undefined,
      token: undefined,
    };

    const result = await ploneConfigure.handler(args, mockExtra);

    expect(result.content[0].text).toEqual(
      `Successfully configured connection to Plone site: ${process.env.PLONE_BASE_URL}`,
    );
    const service = sessionManager.getSession(sessionId);
    expect(service.client?.baseUrl).toBe(process.env.PLONE_BASE_URL);
    // Cleanup env vars
    delete process.env.PLONE_BASE_URL;
    delete process.env.PLONE_USERNAME;
    delete process.env.PLONE_PASSWORD;
    expect(Nock.isDone()).toBe(true); // Use Nock.isDone()
  });
});
