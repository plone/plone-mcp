// Global test setup
import nock from "nock";

// Disable actual HTTP requests during tests
beforeAll(() => {
  nock.disableNetConnect();
  // Allow localhost connections for integration tests
  nock.enableNetConnect("127.0.0.1");
});

afterAll(() => {
  nock.enableNetConnect();
});

// Clean up after each test
afterEach(() => {
  nock.cleanAll();
});

// Increase timeout for integration tests
jest.setTimeout(30000);
