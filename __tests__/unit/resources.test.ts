import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ploneContentResource } from "../../src/resources/content";
import { ploneSiteResource } from "../../src/resources/site";
import { ploneTypesResource } from "../../src/resources/types";
import {
  Nock,
  PloneMockServer,
  sampleDocument,
  createMockContext,
} from "../utils/test-helpers";

const testBaseUrl = "http://localhost:8080/Plone";
const mockContext = createMockContext();

describe("plone-content resource", () => {
  const template = ploneContentResource.config.uriTemplate.uriTemplate;

  it("should match single-segment content paths", () => {
    expect(template.match("plone://content/my-page")).toEqual({
      path: "/my-page",
    });
  });

  it("should match nested content paths", () => {
    expect(template.match("plone://content/en/folder/my-page")).toEqual({
      path: "/en/folder/my-page",
    });
  });

  it("should not match the static site/types resources", () => {
    expect(template.match("plone://site")).toBeNull();
    expect(template.match("plone://types")).toBeNull();
  });
});

describe("resource handlers", () => {
  let mockServer: PloneMockServer;

  beforeEach(() => {
    mockServer = new PloneMockServer(testBaseUrl);
    vi.stubEnv("PLONE_BASE_URL", testBaseUrl);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Nock.cleanAll();
  });

  it("plone-content returns the content item", async () => {
    mockServer.mockContentGet("/test-document", sampleDocument);
    const uri = new URL("plone://content/test-document");

    const result = await ploneContentResource.handler(
      uri,
      { path: "/test-document" },
      mockContext,
    );

    expect(result.contents[0].uri).toBe(uri.href);
    expect(JSON.parse(result.contents[0].text)).toEqual(sampleDocument);
    expect(Nock.isDone()).toBe(true);
  });

  it("plone-content wraps request errors", async () => {
    Nock(testBaseUrl).get("/++api++/missing").reply(404, "Not Found");

    await expect(
      ploneContentResource.handler(
        new URL("plone://content/missing"),
        { path: "/missing" },
        mockContext,
      ),
    ).rejects.toThrow(
      '[plone-content] Failed to fetch content at "/missing": Request failed with status code 404',
    );
  });

  it("plone-site returns the site root", async () => {
    const site = { "@type": "Plone Site", id: "plone", title: "Test Site" };
    mockServer.mockSiteRoot(site);

    const result = await ploneSiteResource.handler(
      new URL("plone://site"),
      mockContext,
    );

    expect(JSON.parse(result.contents[0].text)).toEqual(site);
    expect(Nock.isDone()).toBe(true);
  });

  it("plone-types returns the content types", async () => {
    const types = { items: [{ title: "Page", id: "Document" }] };
    mockServer.mockTypes(types);

    const result = await ploneTypesResource.handler(
      new URL("plone://types"),
      mockContext,
    );

    expect(JSON.parse(result.contents[0].text)).toEqual(types);
    expect(Nock.isDone()).toBe(true);
  });

  it("throws before any request when PLONE_BASE_URL is missing", async () => {
    vi.stubEnv("PLONE_BASE_URL", undefined);

    await expect(
      ploneSiteResource.handler(new URL("plone://site"), mockContext),
    ).rejects.toThrow("Base URL is required");
  });
});
