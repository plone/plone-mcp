// Global test setup
import { beforeAll, afterAll, afterEach } from "vitest";
import { cleanupNock, Nock } from "plone-mcp/__tests__/utils/test-helpers";

// Disable actual HTTP requests during tests
beforeAll(() => {
  Nock.disableNetConnect();
  // Allow localhost connections for integration tests
  Nock.enableNetConnect("127.0.0.1");
});

afterAll(() => {
  Nock.enableNetConnect();
});

// Clean up after each test
afterEach(() => {
  cleanupNock();
});
