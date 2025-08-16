# Acceptance Tests for Plone MCP

This directory contains acceptance tests that verify the end-to-end functionality of the Plone MCP server.

## Test: Create Page "Hello World"

### Purpose
Verifies that when a user requests to "create a page 'Hello World'", the system properly:
- Creates a new Document in the portal root
- Auto-generates a title block with H1 heading containing "Hello World"
- Sets up proper Volto blocks structure
- Makes the page accessible via its URL

### Test Files

1. **`hello-world-acceptance.test.js`** - ✅ **RECOMMENDED** - Complete acceptance test that works reliably
2. **`create-page-hello-world.test.ts`** - Jest-based unit test (has HTTP mocking issues)
3. **`mcp-create-page-test.js`** - Full MCP integration test (has SDK connection issues)

### Running the Tests

#### ✅ Option 1: Direct Acceptance Test (RECOMMENDED)
```bash
npm run test:acceptance:hello-world-direct
```
**Status**: ✅ Works perfectly - 26/26 tests pass  
**Coverage**: Complete end-to-end testing with real Plone site

#### Option 2: Jest Unit Test (Tests PloneClient directly)
```bash
npm run test:acceptance:hello-world
```
**Status**: ❌ HTTP connection blocked by test framework

#### Option 3: Full MCP Integration Test (Tests actual MCP server)
```bash
npm run test:acceptance:mcp
```
**Status**: ❌ MCP SDK connection timeout issues

#### Option 4: All Acceptance Tests
```bash
npm run test:acceptance
```

### Test Configuration

The tests are configured to run against:
- **Server**: `https://plone-intranet.kitconcept.com`
- **Username**: `admin`
- **Password**: `admin`
- **Test Page Title**: `"Hello World Acceptance Test"`
- **Parent Path**: `/` (portal root)

### Expected Behavior

When the test runs successfully, it should:

1. **Connect** to the Plone MCP server
2. **Configure** connection to the Plone site
3. **Create** a page with title "Hello World Acceptance Test"
4. **Verify** that the page contains:
   - Correct title and type
   - Auto-generated title block with H1 structure
   - Proper Volto blocks and blocks_layout
   - Slate format compatible with Volto frontend
5. **Cleanup** by deleting the test page

### Test Assertions

The acceptance test verifies:

✅ **Page Properties**
- Title matches input: `"Hello World Acceptance Test"`
- Type is `"Document"`
- Located in portal root

✅ **Blocks Structure**
- Page has `blocks` object
- Page has `blocks_layout` with items array
- Exactly one block exists (the auto-generated title block)

✅ **Title Block Content**
- Block type is `"slate"`
- Plaintext matches the page title
- Value contains H1 element
- H1 text content matches the page title

✅ **Volto Compatibility**
- All required properties for Volto rendering are present
- Slate block structure is valid for frontend consumption

### Working Test Details (hello-world-acceptance.test.js)

**Test Coverage (26 assertions):**
- ✅ Basic page properties (title, type, URL)
- ✅ Auto-generated title block structure
- ✅ H1 heading with correct text content
- ✅ Proper Volto blocks and blocks_layout
- ✅ Page accessibility via HTTP GET
- ✅ Volto frontend rendering compatibility

**Test Output Example:**
```
🎉 Overall Result: PASSED

🎯 Acceptance Criteria Verification:
✅ Creates new Document page in portal root
✅ Auto-generates title block with H1 heading
✅ Sets up proper Volto blocks structure
✅ Makes page accessible at expected URL
✅ Ensures frontend rendering compatibility
```

**Key Features:**
- Real Plone site testing (not mocked)
- Automatic cleanup (deletes test page after completion)
- Detailed assertion reporting
- Complete blocks structure validation
- Frontend compatibility verification

### Sample Expected Response

```json
{
  "@id": "https://plone-intranet.kitconcept.com/hello-world",
  "@type": "Document",
  "title": "Hello World",
  "blocks": {
    "a7ec59cf-53d5-4551-a0a6-ec4937a80042": {
      "@type": "slate",
      "plaintext": "Hello World",
      "value": [
        {
          "type": "h1",
          "children": [
            {
              "text": "Hello World"
            }
          ]
        }
      ]
    }
  },
  "blocks_layout": {
    "items": ["a7ec59cf-53d5-4551-a0a6-ec4937a80042"]
  }
}
```

### Troubleshooting

**Connection Issues**
- Verify the Plone site is accessible
- Check credentials are correct
- Ensure the MCP server builds successfully (`npm run build`)

**Test Failures**
- Check the test output for specific assertion failures
- Verify the Plone site allows content creation in the root
- Ensure proper cleanup of previous test pages

**Cleanup Issues**
- If test pages aren't cleaned up automatically, manually delete them from the Plone site
- Check user permissions for delete operations

### Extending the Tests

To add more acceptance tests:

1. Create new test files in this directory
2. Follow the naming pattern: `*-test.js` or `*.test.ts`
3. Add npm scripts to `package.json` if needed
4. Update this README with test descriptions

### Related Documentation

- [Plone REST API Documentation](https://plonerestapi.readthedocs.io/)
- [Volto Blocks Documentation](https://docs.volto.plone.org/blocks/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)