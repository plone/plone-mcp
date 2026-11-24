// W3C Trace Context (https://www.w3.org/TR/trace-context/) and Baggage
// (https://www.w3.org/TR/baggage/) values, as MCP clients send them in a
// request's _meta. They come from the client and become outbound headers, so
// anything malformed or oversized is dropped.
const TRACEPARENT = /^[0-9a-f]{2}-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;
const MAX_TRACESTATE_LENGTH = 512;
const MAX_BAGGAGE_LENGTH = 8192;

function validTraceparent(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = TRACEPARENT.exec(value);
  return (
    match !== null &&
    !value.startsWith("ff") &&
    !/^0+$/.test(match[1]) &&
    !/^0+$/.test(match[2])
  );
}

function validListHeader(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length <= maxLength &&
    PRINTABLE_ASCII.test(value)
  );
}

/**
 * Returns the trace context headers to forward to Plone, so one trace covers
 * client -> plone-mcp -> Plone.
 */
export function traceHeaders(
  meta: Record<string, unknown> | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!meta) return headers;

  // tracestate only means something next to a valid traceparent.
  if (validTraceparent(meta.traceparent)) {
    headers.traceparent = meta.traceparent;
    if (validListHeader(meta.tracestate, MAX_TRACESTATE_LENGTH)) {
      headers.tracestate = meta.tracestate;
    }
  }
  if (validListHeader(meta.baggage, MAX_BAGGAGE_LENGTH)) {
    headers.baggage = meta.baggage;
  }
  return headers;
}
