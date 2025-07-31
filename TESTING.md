# Testing Guide for Plone MCP Server

This document describes the comprehensive testing strategy for the Plone MCP server.

## Test Structure

```
tests/
├── setup.ts                    # Global test configuration
├── utils/
│   └── test-helpers.ts         # Test utilities and mocks
├── unit/                       # Unit tests
│   ├── plone-client.test.ts    # PloneClient class tests
│   └── blocks.test.ts          # Block creation logic tests
├── integration/                # Integration tests with mocked APIs
│   └── mcp-server.test.ts      # Full MCP server integration tests
├── functional/                 # Tests against live Plone instances
│   └── live-plone.test.ts      # Real Plone integration tests
└── performance/                # Performance and load tests
    └── load-test.test.ts       # Memory and performance benchmarks
```

## Running Tests

### All Tests
```bash
npm test
```

### By Category
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:functional    # Functional tests only
```

### Development
```bash
npm run test:watch         # Watch mode for development
npm run test:coverage      # Run with coverage report
```

## Test Types

### 1. Unit Tests
- Test individual functions and methods in isolation
- Mock external dependencies
- Fast execution (< 100ms per test)
- High code coverage

**Example:**
```typescript
describe('generateBlockId', () => {
  it('should generate unique block IDs', () => {
    const server = new PloneMCPServer();
    const id1 = server['generateBlockId']();
    const id2 = server['generateBlockId']();
    
    expect(id1).toMatch(/^block-[a-z0-9]{9}$/);
    expect(id2).not.toBe(id1);
  });
});
```

### 2. Integration Tests
- Test component interactions with mocked Plone API
- Verify request/response handling
- Test error scenarios

**Example:**
```typescript
it('should create blocks content successfully', async () => {
  const mockServer = new PloneMockServer();
  mockServer.mockContentCreate('/', expect.any(Object), mockResponse);
  
  const result = await server['handleCreateBlocksContent'](testData);
  expect(result.content[0].text).toContain('Test Document');
});
```

### 3. Functional Tests
- Test against real Plone instances
- End-to-end workflow validation
- Requires live Plone environment

**Setup:**
```bash
export PLONE_TEST_URL="https://your-plone-site.com"
export PLONE_TEST_USER="admin"
export PLONE_TEST_PASS="password"
```

### 4. Performance Tests
- Memory usage validation
- Response time benchmarks
- Concurrent operation testing

## Mock Helpers

The `PloneMockServer` class provides easy mocking of Plone API responses:

```typescript
const mockServer = new PloneMockServer('https://test.plone.com');

// Mock different endpoints
mockServer.mockSiteRoot();
mockServer.mockContentGet('/document', sampleDocument);
mockServer.mockSearch({ query: 'test' }, sampleSearchResults);
```

## Test Configuration

### Environment Variables
- `PLONE_TEST_URL`: URL for functional tests
- `PLONE_TEST_USER`: Username for functional tests  
- `PLONE_TEST_PASS`: Password for functional tests
- `NODE_ENV=test`: Automatically set during test runs

### Jest Configuration
- TypeScript support with ts-jest
- ESM module support
- Coverage collection from `src/` directory
- 30-second timeout for integration tests

## Continuous Integration

Tests run automatically on:
- Every push to `main` and `develop` branches
- All pull requests to `main`
- Multiple Node.js versions (18, 20, 22)

### Coverage Reports
- Minimum 80% code coverage required
- Reports uploaded to Codecov
- HTML reports generated in `coverage/` directory

## Writing New Tests

### Unit Test Checklist
- [ ] Test happy path scenarios
- [ ] Test error conditions
- [ ] Mock external dependencies
- [ ] Verify input validation
- [ ] Check return values

### Integration Test Checklist  
- [ ] Mock HTTP responses
- [ ] Test authentication scenarios
- [ ] Verify request payloads
- [ ] Test error handling
- [ ] Clean up mocks after tests

### Functional Test Checklist
- [ ] Check environment variables
- [ ] Create and cleanup test data
- [ ] Test real workflows
- [ ] Handle network failures gracefully

## Common Patterns

### Testing Async Methods
```typescript
it('should handle async operations', async () => {
  const result = await server['handleAsyncMethod'](args);
  expect(result).toBeDefined();
});
```

### Testing Error Scenarios
```typescript  
it('should throw error for invalid input', async () => {
  await expect(server['method'](invalidArgs))
    .rejects.toThrow('Expected error message');
});
```

### Mocking HTTP Requests
```typescript
nock('https://test.plone.com')
  .post('/++api++/folder', expectedPayload)
  .reply(201, mockResponse);
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Descriptive Names**: Test names should clearly describe what is being tested
3. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
4. **Mock External Dependencies**: Don't make real HTTP requests in unit/integration tests
5. **Clean Up**: Always clean up test data and mocks
6. **Performance Awareness**: Keep tests fast and efficient

## Debugging Tests

### Debug Single Test
```bash
npm test -- --testNamePattern="specific test name"
```

### Debug with Logging
```bash
DEBUG=* npm test
```

### VS Code Debug Configuration
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch", 
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal"
}
```