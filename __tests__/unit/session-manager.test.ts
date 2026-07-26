import { describe, it, expect } from "vitest";
import { sessionManager } from "../../src/session-manager";
import { PloneService } from "../../src/plone-service";

describe("SessionManager", () => {
  it("should return a session for a given sessionId", () => {
    const session = sessionManager.getSession("test-session");
    expect(session).toBeInstanceOf(PloneService);
  });

  it("should return the same session instance for the same sessionId", () => {
    const session1 = sessionManager.getSession("session-1");
    const session2 = sessionManager.getSession("session-1");
    expect(session1).toBe(session2);
  });

  it("should return different sessions for different sessionIds", () => {
    const session1 = sessionManager.getSession("session-1");
    const session2 = sessionManager.getSession("session-2");
    expect(session1).not.toBe(session2);
  });

  it("should clear a session", () => {
    const session1 = sessionManager.getSession("to-be-cleared");
    sessionManager.clearSession("to-be-cleared");
    const session2 = sessionManager.getSession("to-be-cleared");
    expect(session1).not.toBe(session2);
  });
});
