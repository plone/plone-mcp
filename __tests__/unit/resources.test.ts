import { describe, it, expect } from "vitest";
import { ploneContentResource } from "../../src/resources/content";

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
