# Testing Guide for Plone MCP Server

This document describes the testing strategy for the Plone MCP server. Tests run
on [Vitest](https://vitest.dev/) with [nock](https://github.com/nock/nock) for
HTTP mocking.

## Test Structure

```
__tests__/
├── setup.ts                       # Global test configuration
├── utils/
│   └── test-helpers.ts            # PloneMockServer + nock helpers
├── unit/                          # Unit tests (isolated logic)
│   ├── block-registry.test.ts
│   ├── block-utils.test.ts
│   ├── markdown-parser.test.ts
│   ├── plone-client.test.ts
│   ├── plone-service.test.ts
│   ├── plone_delete_content.test.ts
│   ├── session.test.ts
│   └── session-manager.test.ts
└── integration/                   # Integration tests (mocked Plone API)
    ├── plone_configure.test.ts
    ├── plone_create_content.test.ts
    ├── plone_search.test.ts
    └── ...                         # one file per tool
```

## Running Tests

### All Tests
```bash
npm test
```

### By Category
```bash
npm run test:unit          # Unit tests only (__tests__/unit)
npm run test:integration   # Integration tests only (__tests__/integration)
```

### Coverage
```bash
npx vitest run --coverage
```

### Watch Mode
```bash
npx vitest
```

## Test Types

### 1. Unit Tests
- Test individual functions and modules in isolation
- Mock external dependencies
- Fast execution
- Cover parsing, block logic, session handling, and the Plone client

### 2. Integration Tests
- Exercise each MCP tool end-to-end against a mocked Plone API
- Verify request payloads and response handling
- Cover error scenarios
- One file per tool (`plone_create_content`, `plone_search`, ...)

## Mock Helpers

The `PloneMockServer` class (`__tests__/utils/test-helpers.ts`) wraps nock to
mock Plone REST API responses:

```typescript
import { PloneMockServer } from "../utils/test-helpers";

const mockServer = new PloneMockServer("https://test.plone.com");
mockServer.mockSiteRoot();
mockServer.mockContentGet("/document", sampleDocument);
mockServer.mockSearch({ query: "test" }, sampleSearchResults);
```

Cleanup helpers are also exported:

```typescript
import { cleanupNock, isNockDone } from "../utils/test-helpers";
```

## Test Configuration

- Vitest config lives in `vitest.config.ts` / `vitest.config.mts`.
- Type-checking for tests uses `tsconfig.test.json` (`npm run type-check:tests`).
- Global setup runs from `__tests__/setup.ts`.

## Continuous Integration

CI is defined in `.github/workflows/test.yml`. On every push to `main` and every
pull request it:

1. Installs dependencies (`npm ci`)
2. Builds the project (`npm run build`)
3. Runs unit tests (`npm run test:unit`)
4. Runs all tests with coverage (`npm run test:coverage`)
5. Uploads coverage to Codecov

Node version: 22.x.

## Writing New Tests

### Unit Test Checklist
- [ ] Test happy path scenarios
- [ ] Test error conditions
- [ ] Mock external dependencies
- [ ] Verify input validation
- [ ] Check return values

### Integration Test Checklist
- [ ] Mock HTTP responses with `PloneMockServer`
- [ ] Test authentication scenarios
- [ ] Verify request payloads
- [ ] Test error handling
- [ ] Clean up mocks after each test

## Common Patterns

### Testing Async Methods
```typescript
it("handles async operations", async () => {
  const result = await someAsyncCall(args);
  expect(result).toBeDefined();
});
```

### Testing Error Scenarios
```typescript
it("throws for invalid input", async () => {
  await expect(someCall(invalidArgs)).rejects.toThrow("Expected error message");
});
```

### Mocking HTTP Requests
```typescript
import { Nock } from "../utils/test-helpers";

Nock("https://test.plone.com")
  .post("/++api++/folder", expectedPayload)
  .reply(201, mockResponse);
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Descriptive Names**: Test names should clearly describe what is verified
3. **Arrange-Act-Assert**: Clear setup, execution, and verification
4. **Mock External Dependencies**: No real HTTP requests in tests
5. **Clean Up**: Always clean up mocks (`cleanupNock`) after tests

## Debugging Tests

### Run a Single File
```bash
npx vitest run __tests__/unit/plone-client.test.ts
```

### Filter by Test Name
```bash
npx vitest run -t "specific test name"
```

### VS Code Debug Configuration
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run"],
  "console": "integratedTerminal"
}
```
