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

1. **`create-page-hello-world.test.ts`** - Jest-based unit test that tests the PloneClient directly
2. **`mcp-create-page-test.js`** - Full MCP integration test that spawns the actual MCP server

### Running the Tests

#### Option 1: Jest Unit Test (Tests PloneClient directly)
```bash
npm run test:acceptance:hello-world
```

#### Option 2: Full MCP Integration Test (Tests actual MCP server)
```bash
npm run test:acceptance:mcp
```

#### Option 3: All Acceptance Tests
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

### Sample Expected Response

```json
{
  "@id": "https://plone-intranet.kitconcept.com/hello-world-acceptance-test",
  "@type": "Document",
  "title": "Hello World Acceptance Test",
  "blocks": {
    "12345678-1234-4abc-abcd-123456789abc": {
      "@type": "slate",
      "plaintext": "Hello World Acceptance Test",
      "value": [
        {
          "type": "h1",
          "children": [
            {
              "text": "Hello World Acceptance Test"
            }
          ]
        }
      ]
    }
  },
  "blocks_layout": {
    "items": ["12345678-1234-4abc-abcd-123456789abc"]
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