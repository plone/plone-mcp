import { describe, it, expect } from "vitest";
import { markdownParse } from "../../src/markdown-parser";

describe("Markdown Parser (Slate Conversion)", () => {
  it("should parse simple text into a paragraph", () => {
    const markdown = "Hello World";
    const result = markdownParse(markdown);

    expect(result).toEqual([
      {
        type: "p",
        children: [{ text: "Hello World" }],
      },
    ]);
  });

  it("should parse headings", () => {
    const markdown = "# Heading 1\n## Heading 2\n### Heading 3";
    const result = markdownParse(markdown);

    expect(result).toEqual([
      { type: "h1", children: [{ text: "Heading 1" }] },
      { type: "h2", children: [{ text: "Heading 2" }] },
      { type: "h3", children: [{ text: "Heading 3" }] },
    ]);
  });

  it("should parse bold and italic text", () => {
    const markdown = "**Bold** and *Italic* text";
    const result = markdownParse(markdown);

    expect(result).toEqual([
      {
        type: "p",
        children: [
          { type: "strong", children: [{ text: "Bold" }] },
          { text: " and " },
          { type: "em", children: [{ text: "Italic" }] },
          { text: " text" },
        ],
      },
    ]);
  });

  it("should parse links", () => {
    const markdown = "[Plone](https://plone.org)";
    const result = markdownParse(markdown);

    expect(result).toEqual([
      {
        type: "p",
        children: [
          {
            type: "link",
            data: { url: "https://plone.org" },
            children: [{ text: "Plone" }],
          },
        ],
      },
    ]);
  });

  it("should parse unordered lists", () => {
    const markdown = "- Item 1\n- Item 2";
    const result = markdownParse(markdown);

    expect(result).toEqual([
      {
        type: "ul",
        children: [
          { type: "li", children: [{ type: "p", children: [{ text: "Item 1" }] }] },
          { type: "li", children: [{ type: "p", children: [{ text: "Item 2" }] }] },
        ],
      },
    ]);
  });

  it("should parse ordered lists", () => {
    const markdown = "1. First\n2. Second";
    const result = markdownParse(markdown);

    expect(result).toEqual([
      {
        type: "ol",
        children: [
          { type: "li", children: [{ type: "p", children: [{ text: "First" }] }] },
          { type: "li", children: [{ type: "p", children: [{ text: "Second" }] }] },
        ],
      },
    ]);
  });

  it("should parse complex nested markdown", () => {
    const markdown = "This is **bold and *italic* and [a link](https://plone.org)**";
    const result = markdownParse(markdown);

    expect(result).toEqual([
      {
        type: "p",
        children: [
          { text: "This is " },
          {
            type: "strong",
            children: [
              { text: "bold and " },
              { type: "em", children: [{ text: "italic" }] },
              { text: " and " },
              {
                type: "link",
                data: { url: "https://plone.org" },
                children: [{ text: "a link" }],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("should return empty array for empty input", () => {
    expect(markdownParse("")).toEqual([]);
  });

  it("should throw error for non-string input", () => {
    // @ts-expect-error - testing invalid input
    expect(() => markdownParse(null)).toThrow("Input must be a string");
  });
});
