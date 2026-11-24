import { describe, it, expect } from "vitest";
import { traceHeaders } from "plone-mcp/trace-context";

const traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

describe("traceHeaders", () => {
  it("forwards valid trace context", () => {
    expect(
      traceHeaders({ traceparent, tracestate: "vendor=abc", baggage: "user=1" }),
    ).toEqual({ traceparent, tracestate: "vendor=abc", baggage: "user=1" });
  });

  it("returns nothing without _meta", () => {
    expect(traceHeaders(undefined)).toEqual({});
    expect(traceHeaders({})).toEqual({});
  });

  it.each([
    ["uppercase", traceparent.toUpperCase()],
    ["too short", traceparent.slice(1)],
    ["version ff", `ff${traceparent.slice(2)}`],
    ["zero trace id", `00-${"0".repeat(32)}-00f067aa0ba902b7-01`],
    ["zero parent id", `00-4bf92f3577b34da6a3ce929d0e0e4736-${"0".repeat(16)}-01`],
    ["not a string", 42],
  ])("drops a traceparent that is %s, and its tracestate", (_, value) => {
    expect(traceHeaders({ traceparent: value, tracestate: "vendor=abc" })).toEqual(
      {},
    );
  });

  it.each([
    ["a line break", "a=1\r\nX-Injected: yes"],
    ["a non-ASCII character", "a=ü"],
    ["an empty value", ""],
  ])("drops tracestate and baggage containing %s", (_, value) => {
    expect(traceHeaders({ traceparent, tracestate: value, baggage: value })).toEqual(
      { traceparent },
    );
  });

  it("drops oversized tracestate and baggage", () => {
    expect(
      traceHeaders({
        traceparent,
        tracestate: "a".repeat(513),
        baggage: "a".repeat(8193),
      }),
    ).toEqual({ traceparent });
  });

  it("forwards baggage without a traceparent", () => {
    expect(traceHeaders({ baggage: "user=1" })).toEqual({ baggage: "user=1" });
  });
});
