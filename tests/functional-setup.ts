// Setup for functional tests - allow real network connections
import nock from 'nock';

// Enable all network connections for functional tests
beforeAll(() => {
  nock.enableNetConnect();
});

// Increase timeout for real network requests
jest.setTimeout(30000);