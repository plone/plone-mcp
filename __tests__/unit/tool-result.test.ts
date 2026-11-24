import { describe, it, expect } from "vitest";
import { toolResult } from "plone-mcp/utils/tool-result";

describe("toolResult", () => {
  it("returns the value as structured content and as JSON text", () => {
    const value = { "@id": "http://localhost:8080/Plone/page", title: "Page" };

    expect(toolResult(value)).toEqual({
      content: [{ type: "text", text: JSON.stringify(value) }],
      structuredContent: value,
    });
  });

  it("accepts any JSON value", () => {
    expect(toolResult([1, 2]).structuredContent).toEqual([1, 2]);
    expect(toolResult(null).content[0].text).toBe("null");
  });

  it("uses the given text instead of JSON", () => {
    const result = toolResult({ path: "/page", deleted: true }, "Deleted /page");

    expect(result.content).toEqual([{ type: "text", text: "Deleted /page" }]);
    expect(result.structuredContent).toEqual({ path: "/page", deleted: true });
  });
});
