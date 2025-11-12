# Plone MCP Server

A Model Context Protocol (MCP) server for integrating MCP clients with Plone CMS via REST API. Enables content management, search, workflow operations, and Volto blocks management.

## Prerequisites

- **Node.js 18+** - Required to run the server (install: `brew install node` on macOS or from [nodejs.org](https://nodejs.org))
- **pnpm 8+** - Package manager (install: `npm install -g pnpm` or `brew install pnpm` on macOS)
- **Plone 6.0+** site with REST API - The CMS you'll be connecting to

## Quick Start using Claude Desktop as an example

1. **Install**
```bash
git clone git@github.com:plone/plone-mcp.git
cd plone-mcp
pnpm install
pnpm run build
```

2. **Configure Claude Desktop**

Add to Claude's configuration file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**With environment variables (optional):**
```json
{
  "mcpServers": {
    "plone": {
      "command": "node",
      "args": ["/absolute/path/to/plone-mcp/dist/index.js"],
      "env": {
        "PLONE_BASE_URL": "https://demo.plone.org",
        "PLONE_USERNAME": "admin",
        "PLONE_PASSWORD": "admin",
        "ENABLED_TOOLS": "plone_get_content,plone_create_content"
      }
    }
  }
}
```

**Without environment variables:**
```json
{
  "mcpServers": {
    "plone": {
      "command": "node",
      "args": ["/absolute/path/to/plone-mcp/dist/index.js"]
    }
  }
}
```

3. **Restart Claude Desktop**

4. **Connect to Plone**

Call `plone_configure` once per session:

```javascript
// Using environment variables
plone_configure({})

// OR providing credentials/token directly to the LLM
plone_configure({
  "baseUrl": "https://demo.plone.org",
  "username": "admin",
  "password": "admin"
})

plone_configure({
  "baseUrl": "https://demo.plone.org",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
})
```

**Note:** Arguments take precedence over environment variables.

## Core Features

- **Content Management**: CRUD operations on all Plone content types
- **Block System**: Create and manage Volto blocks
- **Search**: Full-text search with filtering and sorting
- **Workflow**: Manage publication states and transitions
- **Site Info**: Access content types, vocabularies, and site configuration

## Available Tools

This section provides a comprehensive list of all tools available in the Plone MCP server, along with their descriptions and example usage.

### Configuration

*   **`plone_configure`**
    *   **Description:** Establishes and authenticates the connection to a Plone CMS. **Must be called once per session** before other tools can be used. Configuration can be provided via arguments or environment variables (PLONE_BASE_URL, PLONE_USERNAME, PLONE_PASSWORD, PLONE_TOKEN). Arguments take precedence over environment variables. To use environment variables only, call with an empty object: `plone_configure({})`.
    *   **Example:**
        ```javascript
        plone_configure({baseUrl: 'https://demo.plone.org', username: 'admin', password: 'secret'})
        ```

### Content Management

*   **`plone_get_content`**
    *   **Description:** Retrieves the full JSON data for a single content item from Plone using its path.
    *   **Example:**
        ```javascript
        plone_get_content({path: '/news/latest-update'})
        ```
*   **`plone_create_content`**
    *   **Description:** Creates a new content item (e.g., a page or news article) in Plone. To add complex block-based content, first prepare the structure with `plone_create_blocks_layout`, then call this tool.
    *   **Example:**
        ```javascript
        plone_create_content({parentPath: '/', type: 'Document', title: 'My Page', description: 'A sample page'})
        ```
*   **`plone_update_content`**
    *   **Description:** Modifies an existing content item in Plone. Can update metadata (like title) and/or replace the entire block structure. Use `plone_create_blocks_layout` to prepare complex block updates.
    *   **Example:**
        ```javascript
        plone_update_content({path: '/my-page', title: 'Updated Title'})
        ```
*   **`plone_delete_content`**
    *   **Description:** Permanently deletes a content item from Plone using its path.
    *   **Example:**
        ```javascript
        plone_delete_content({path: '/old-content'})
        ```

### Search and Discovery

*   **`plone_search`**
    *   **Description:** Performs a detailed search for content items, allowing filters by text, content type, path, and workflow state.
    *   **Example:**
        ```javascript
        plone_search({query: 'annual report', portal_type: ['Document'], review_state: ['published']})
        ```
*   **`plone_get_site_info`**
    *   **Description:** Retrieves top-level information and metadata about the connected Plone site, such as available languages and Plone version.
    *   **Example:**
        ```javascript
        plone_get_site_info({})
        ```
*   **`plone_get_types`**
    *   **Description:** Lists all available content types that can be created in the Plone site (e.g., 'Document', 'Event').
    *   **Example:**
        ```javascript
        plone_get_types({})
        ```
*   **`plone_get_vocabularies`**
    *   **Description:** Fetches the allowed values for a specific field, such as a list of categories or tags. Useful for finding valid inputs for content fields.
    *   **Example:**
        ```javascript
        plone_get_vocabularies({vocabulary: 'plone.app.vocabularies.Keywords'})
        ```

### Workflow Management

*   **`plone_get_workflow_info`**
    *   **Description:** Shows the current workflow state (e.g., 'Published', 'Private') and available transitions for a content item.
    *   **Example:**
        ```javascript
        plone_get_workflow_info({path: '/my-document'})
        ```
*   **`plone_transition_workflow`**
    *   **Description:** Changes the workflow state of a content item by executing a specific transition, like 'publish' or 'submit'.
    *   **Example:**
        ```javascript
        plone_transition_workflow({path: '/my-document', transition: 'publish'})
        ```

### Block Management

*   **`plone_get_block_schemas`**
    *   **Description:** Lists all available Volto block types (e.g., 'slate', 'teaser', 'button') and their required data schemas. **Essential for understanding how to construct blocks.**
    *   **Example:**
        ```javascript
        plone_get_block_schemas({blockType: 'teaser'})
        ```
*   **`plone_create_blocks_layout`**
    *   **Description:** Prepares a complete block structure in memory (valid for 60 seconds). This structure is then used by the **next immediate call** to `plone_create_content` or `plone_update_content`. Use `plone_get_block_schemas` to learn what data each block type needs. The text displayed by the Title block is automatically managed by Plone, DO NOT add it in the block's data.
    *   **Example:**
        ```javascript
        plone_create_blocks_layout({blocks: [{type: 'title'},{type: 'slate', data: {text: 'Hello World'}}]})
        ```
*   **`plone_add_single_block`**
    *   **Description:** Adds a single new block to an existing content item without replacing other blocks. Specify the block type, data, and optional position.
    *   **Example:**
        ```javascript
        plone_add_single_block({path: '/my-page', blockType: 'text', blockData: {text: 'New paragraph'}})
        ```
*   **`plone_update_single_block`**
    *   **Description:** Modifies the data of a single, existing block within a content item, identified by its block ID.
    *   **Example:**
        ```javascript
        plone_update_single_block({path: '/my-page', blockId: 'abc123', blockData: {text: 'Updated text'}})
        ```
*   **`plone_remove_single_block`**
    *   **Description:** Deletes a single block from a content item, identified by its block ID.
    *   **Example:**
        ```javascript
        plone_remove_single_block({path: '/my-page', blockId: 'abc123'})
        ```

## Block Management

### Creating Content with Blocks

```javascript
// 1. Prepare blocks (60-second TTL - meant to be used inmediatly before content creation/editing)
plone_create_blocks_layout({
  "blocks": [
    {
      "type": "text",
      "data": {"text": "Welcome to our site!"}
    },
    {
      "type": "teaser",
      "data": {
        "href": "/about",
        "title": "Learn More",
        "description": "Discover what we do"
      }
    }
  ]
})

// 2. Create content (within 60 seconds), the previously prepared blocks will automatically be included in the request
plone_create_content({
  "parentPath": "/",
  "type": "Document",
  "title": "Homepage"
})
```

### Managing Individual Blocks

```javascript
// Add a single block
plone_add_single_block({
  "path": "/homepage",
  "blockType": "text",
  "blockData": {"text": "New paragraph"},
  "position": 1
})

// Update a block
plone_update_single_block({
  "path": "/homepage",
  "blockId": "51176ead-7b59-402d-9412-baed46821b36",  // Get ID from plone_get_content
  "blockData": {"text": "Updated text"}
})

// Remove a block
plone_remove_single_block({
  "path": "/homepage",
  "blockId": "51176ead-7b59-402d-9412-baed46821b36"
})
```

## Available Block Types

- **text**: Rich text content
- **teaser**: Link preview card with image
- **__button**: Call-to-action button
- **separator**: Visual divider line

Use `plone_get_block_schemas()` to see all block types and their properties.

## Common Workflows

### Create and Publish a Page

```javascript
// Configure connection
plone_configure({baseUrl: "https://mysite.com", username: "editor", password: "secret"})

// Create with blocks
plone_create_blocks_layout({
  "blocks": [{"type": "text", "data": {"text": "Article content..."}}]
})
plone_create_content({
  "parentPath": "/news",
  "type": "News Item",
  "title": "Breaking News"
})

// Publish
plone_transition_workflow({
  "path": "/news/breaking-news",
  "transition": "publish"
})
```

### Search and Filter

```javascript
plone_search({
  "query": "annual report",
  "portal_type": ["Document", "File"],
  "review_state": ["published"],
  "sort_on": "modified",
  "sort_order": "descending",
  "b_size": 10
})
```

## Important Notes

⚠️ **Prepared blocks expire after 60 seconds** - Always call `plone_create_blocks_layout` immediately before creating/updating content.

⚠️ **Configure once per session** - Run `plone_configure` once at the start of each session before using other tools. Once configured, you can use all other tools without reconfiguring. The `plone_configure` tool is always enabled and does not require explicit enabling via `ENABLED_TOOLS`.

## Environment Variables

The following environment variables can be used to configure the Plone MCP server:

*   **`PLONE_BASE_URL`**: The base URL of your Plone site (e.g., `https://demo.plone.org`).
*   **`PLONE_USERNAME`**: The username for authenticating with the Plone site.
*   **`PLONE_PASSWORD`**: The password for the specified username.
*   **`PLONE_TOKEN`**: A JWT token for authentication (alternative to username/password).
*   **`ENABLED_TOOLS`**: (Optional) A comma-separated list of tool names to explicitly enable (e.g., `plone_get_content,plone_create_content`). If this variable is not set, all tools (except `plone_configure`, which is always enabled) will be available by default.

## Development

```bash
# Development mode with hot reload
pnpm run dev

# Test with MCP Inspector
pnpm run inspector

# Build for production
pnpm run build
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Plone client not configured" | Run `plone_configure` once at the start of your session |
| "Block not found" | Use `plone_get_content` to get valid block IDs |
| Connection errors | Verify Plone URL and credentials are correct |
| Blocks not applied | Call `plone_create_blocks_layout` immediately before create/update (60s TTL) |
| TypeScript errors during build | Run `pnpm install` to ensure all dependencies are installed |

## Resources

- [Plone REST API Documentation](https://plonerestapi.readthedocs.io/)
- [MCP Documentation](https://modelcontextprotocol.io/docs)

## License

MIT
