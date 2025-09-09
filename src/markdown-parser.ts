import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, Node } from 'mdast';

// Type definitions for our Slate-like format
interface SlateNode {
  type?: string;
  text?: string;
  children?: SlateNode[];
  data?: { url: string };
}

/**
 * Transforms a remark AST (mdast) node into a custom, Slate-like JSON format.
 * This is a recursive function that traverses the syntax tree.
 */
function transform(node: Node): SlateNode | SlateNode[] | null {
  if (!node) {
    return null;
  }

  // Recursively transform all child nodes of the current node.
  // We filter out any null results (e.g., for node types we want to ignore).
  const children: SlateNode[] = 'children' in node && Array.isArray(node.children)
    ? (node.children as Node[]).map(transform).filter(Boolean).flat() as SlateNode[]
    : [];

  // Map mdast node types to the desired custom format.
  switch (node.type) {
    case 'root':
      // The root node's children are the top-level block elements.
      return children;

    case 'heading':
      return { type: `h${'depth' in node ? node.depth : 1}`, children };

    case 'paragraph':
      // Ensure paragraphs always have children, even if it's just an empty text node.
      return { type: 'p', children: children.length > 0 ? children : [{ text: '' }] };

    case 'blockquote':
      return { type: 'blockquote', children };

    case 'list':
      return { type: ('ordered' in node && node.ordered) ? 'ol' : 'ul', children };

    case 'listItem':
      // Remark wraps list item content in paragraphs, which we unwrap to match the original output format.
      return { type: 'li', children: children.length > 0 ? children : [{ text: '' }] };

    case 'strong':
      return { type: 'strong', children };

    case 'emphasis':
      return { type: 'em', children };

    case 'delete': // Provided by remark-gfm for ~~strikethrough~~
      return { type: 'del', children };

    case 'link':
      const url = ('url' in node && typeof node.url === 'string') ? node.url : '';
      const title = ('title' in node && typeof node.title === 'string') ? node.title : '';
      return {
        type: 'link',
        data: { url },
        children: children.length > 0 ? children : [{ text: title }]
      };

    case 'text':
      const value = ('value' in node && typeof node.value === 'string') ? node.value : '';
      return { text: value };
    
    case 'thematicBreak': // Represents <hr> (---, ***), ignored to match original functionality.
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
  if (typeof markdownText !== 'string') {
    throw new Error('Input must be a string');
  }
  if (!markdownText) {
    return [];
  }

  try {
    // 1. Create a unified processor.
    // 2. Use remark-parse to turn markdown into a syntax tree (mdast).
    // 3. Use remark-gfm to add support for GitHub Flavored Markdown (like strikethrough).
    // 4. Run the parser.
    const ast = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .parse(markdownText);
    
    // Transform the generated AST into the desired final format.
    const result = transform(ast as Root);
    return Array.isArray(result) ? result : result ? [result] : [];
  } catch (error) {
    console.error("Markdown parsing with remark failed:", error);
    throw new Error(`Markdown parsing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Export is already done above in the function declaration