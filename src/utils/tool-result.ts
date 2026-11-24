/**
 * Builds a tool result whose text and `structuredContent` come from the same
 * value, so the two cannot drift apart. Clients without structured output read
 * the text, which defaults to the value as JSON.
 */
export function toolResult(value: unknown, text = JSON.stringify(value)) {
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: value,
  };
}
