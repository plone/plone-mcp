import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkSupersub from "remark-supersub";
import type { Root, Node } from "mdast";

// Type definitions for our Slate format
interface SlateNode {
  type?: string;
  text?: string;
  children?: SlateNode[];
  data?: { url: string };
}

// Helper functions
function getNodeProperty(node: Node, property: string): string {
  return property in node && typeof node[property as keyof Node] === "string" 
    ? (node[property as keyof Node] as string) 
    : "";
}

function ensureChildren(children: SlateNode[]): SlateNode[] {
  return children.length > 0 ? children : [{ text: "" }];
}

/**
 * Transforms a remark AST (mdast) node into a custom, Slate JSON format.
 * This is a recursive function that traverses the syntax tree.
 */
function transform(node: Node): SlateNode | SlateNode[] | null {
  if (!node) {
    return null;
  }

  // Recursively transform all child nodes of the current node.
  // We filter out any null results (e.g., for node types we want to ignore).
  const children: SlateNode[] =
    "children" in node && Array.isArray(node.children)
      ? ((node.children as Node[])
          .map(transform)
          .filter(Boolean)
          .flat() as SlateNode[])
      : [];

  // Map mdast node types to the desired custom format.
  switch (node.type) {
    case "root":
      // The root node's children are the top-level block elements.
      return children;

    case "heading":
      const depth = "depth" in node && typeof node.depth === "number" ? node.depth : 2;
      return { type: `h${depth}`, children };

    case "paragraph":
      // Ensure paragraphs always have children, even if it's just an empty text node.
      return {
        type: "p",
        children: ensureChildren(children),
      };

    case "blockquote":
      return { type: "blockquote", children };

    case "list":
      const isOrdered = "ordered" in node && node.ordered === true;
      return {
        type: isOrdered ? "ol" : "ul",
        children,
      };

    case "listItem":
      // Remark wraps list item content in paragraphs, which we unwrap to match the original output format.
      return {
        type: "li",
        children: ensureChildren(children),
      };

    case "strong":
      return { type: "strong", children };

    case "emphasis":
      return { type: "em", children };

    case "delete":
      return { type: "del", children };

    case "superscript":
      return { type: "sup", children };

    case "subscript":
      return { type: "sub", children };

    case "link":
      const url = getNodeProperty(node, "url");
      const title = getNodeProperty(node, "title");
      return {
        type: "link",
        data: { url },
        children: children.length > 0 ? children : [{ text: title }],
      };

    case "text":
      const value = getNodeProperty(node, "value");
      return { text: value };

    case "thematicBreak": // Represents <hr> (---, ***), ignored to match original functionality.
      return null;

    default:
      // For any unhandled node types, we return their children. This effectively
      // flattens them in the final structure.
      return children;
  }
}

/**
 * Parses a markdown string into a custom JSON structure using the remark library.
 * This function handles block-level and inline-level markdown syntax.
 */
export function markdownParse(markdownText: string): SlateNode[] {
  // Input validation
  if (typeof markdownText !== "string") {
    throw new Error("Input must be a string");
  }
  if (!markdownText) {
    return [];
  }

  try {
    // 1. Create a unified processor.
    // 2. Use remark-parse to turn markdown into a syntax tree (mdast).
    // 3. Use remark-gfm to add support for strikethrough.
    // 4. Use remark-supersub to add support for superscript and subscript.
    // 5. Run the parser.
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm, { singleTilde: false })
      .use(remarkSupersub);

    const ast = processor.runSync(processor.parse(markdownText));

    // Transform the generated AST into the desired final format.
    const result = transform(ast as Root);
    return Array.isArray(result) ? result : result ? [result] : [];
  } catch (error) {
    console.error("Markdown parsing with remark failed:", error);
    throw new Error(
      `Markdown parsing failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
