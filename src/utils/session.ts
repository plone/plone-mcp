type HeadersLike =
  | {
      get?: (name: string) => string | string[] | null | undefined;
      [key: string]: unknown;
    }
  | undefined
  | null;

const SESSION_HEADER = "mcp-session-id";

/**
 * Safely read case-insensitive header values from XMCP headers helper output.
 */
export function getHeaderValue(
  headers: HeadersLike,
  name: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }

  const normalized = name.toLowerCase();
  let value: string | string[] | null | undefined;

  // Check if headers object has a 'get' method (like Headers or custom objects)
  if (typeof headers.get === "function") {
    value =
      headers.get(name) ??
      headers.get(normalized) ??
      headers.get(name.toUpperCase());
    const normalizedValue = normalizeValue(value);
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  // Fallback to direct property access for plain objects
  const directCandidate =
    (headers as Record<string, unknown>)[name] ??
    (headers as Record<string, unknown>)[normalized] ??
    (headers as Record<string, unknown>)[name.toUpperCase()];

  return normalizeValue(
    directCandidate as string | string[] | null | undefined,
  );
}

/**
 * Resolve the MCP session id header or fall back to "default".
 */
export function getSessionId(headers: HeadersLike): string {
  return getHeaderValue(headers, SESSION_HEADER) ?? "default";
}

function normalizeValue(
  value: string | string[] | null | undefined,
): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.length > 0,
    );
  }
  return undefined;
}
