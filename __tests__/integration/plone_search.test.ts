import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Nock ,
  PloneMockServer,
  sampleSearchResults,
} from "plone-mcp/__tests__/utils/test-helpers";
import { ploneSearch } from "plone-mcp/tools/plone_search";
import { PloneClient } from "plone-mcp/plone-client";
import { sessionManager } from "plone-mcp/session-manager";

describe("plone_search", () => {
  let mockServer: PloneMockServer;
  const testBaseUrl = "http://localhost:8080/Plone";

  const sessionId = "test-session-id";
  const mockExtra = {
    sessionId,
    signal: new AbortController().signal,
    requestId: "test-request-id",
  } as any;

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);
    const service = sessionManager.getSession(sessionId);
    service.client = new PloneClient({ baseUrl: testBaseUrl });
  });

  afterEach(() => {
    Nock.cleanAll();
    sessionManager.clearSession(sessionId);
  });

  it("should successfully perform a basic search", async () => {
    const query = "annual report";
    mockServer.mockSearch({ SearchableText: query }, sampleSearchResults);

    const args = {
      query: query,
      portal_type: undefined,
      path: undefined,
      review_state: undefined,
      sort_on: undefined,
      sort_order: undefined,
      b_size: undefined,
      b_start: undefined,
    };
    const result = await ploneSearch.handler(args, mockExtra);

    expect(JSON.parse(result.content[0].text)).toEqual(sampleSearchResults);
    expect(Nock.isDone()).toBe(true);
  });

  it("should perform search with all filters", async () => {
    const filters: {
      query: string;
      portal_type: string[];
      path: string;
      review_state: string[];
      sort_on: string;
      sort_order: "ascending" | "descending";
      b_size: number;
      b_start: number;
    } = {
      query: "filtered search",
      portal_type: ["Document", "Folder"],
      path: "/docs",
      review_state: ["published"],
      sort_on: "modified",
      sort_order: "descending",
      b_size: 10,
      b_start: 0,
    };

    mockServer.mockSearch(
      {
        SearchableText: filters.query,
        portal_type: filters.portal_type,
        path: filters.path,
        review_state: filters.review_state,
        sort_on: filters.sort_on,
        sort_order: filters.sort_order,
        b_size: filters.b_size,
        b_start: filters.b_start,
      },
      sampleSearchResults,
    );

    const args = filters;
    await ploneSearch.handler(args, mockExtra);

    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if search fails", async () => {
    const query = "failing search";
    Nock(testBaseUrl)
      .get("/++api++/@search")
      .query({ SearchableText: query })
      .reply(500, "Server Error");

    const args = {
      query: query,
      portal_type: undefined,
      path: undefined,
      review_state: undefined,
      sort_on: undefined,
      sort_order: undefined,
      b_size: undefined,
      b_start: undefined,
    };
    await expect(ploneSearch.handler(args, mockExtra)).rejects.toThrow(
      "[Search] Request failed with status code 500",
    );
    expect(Nock.isDone()).toBe(true);
  });

  it("should throw an error if Plone client is not configured", async () => {
    const service = sessionManager.getSession(sessionId);
    service.client = null;

    const args = {
      query: "any",
      portal_type: undefined,
      path: undefined,
      review_state: undefined,
      sort_on: undefined,
      sort_order: undefined,
      b_size: undefined,
      b_start: undefined,
    };
    await expect(ploneSearch.handler(args, mockExtra)).rejects.toThrow(
      "Plone client not configured. Please run plone_configure first.",
    );
    expect(Nock.pendingMocks()).toHaveLength(0); // No API call should be made
  });
});
