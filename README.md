# Plone MCP Server

A Model Context Protocol (MCP) server for integrating MCP clients with Plone CMS via REST API. Enables content management, search, workflow operations, and Volto blocks management.

## Prerequisites

- **Node.js 18+** - Required to run the server (install: `brew install node` on macOS or from [nodejs.org](https://nodejs.org))
- **pnpm 8+** - Package manager (install: `npm install -g pnpm` or `brew install pnpm` on macOS)
- **Plone 6.0+** site with REST API - The CMS you'll be connecting to

## Quick Start using Claude Desktop as an example

1. **Install**
```bash
git clone git@github.com:kitconcept/plone-mcp.git
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
        "PLONE_PASSWORD": "admin"
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

## Essential Tools

| Tool | Description | Example |
|------|-------------|---------|
| `plone_configure` | Connect to Plone (call once per session) | `plone_configure({baseUrl, username, password})` or `plone_configure({})` for env vars |
| `plone_get_content` | Get content by path | `plone_get_content({path: "/news"})` |
| `plone_create_content` | Create new content | `plone_create_content({parentPath: "/", type: "Document", title: "Page"})` |
| `plone_update_content` | Update existing content | `plone_update_content({path: "/page", title: "New Title"})` |
| `plone_delete_content` | Delete content | `plone_delete_content({path: "/old-page"})` |
| `plone_search` | Search content | `plone_search({query: "news", portal_type: ["Document"]})` |
| `plone_transition_workflow` | Change workflow state | `plone_transition_workflow({path: "/page", transition: "publish"})` |

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

⚠️ **Configure once per session** - Run `plone_configure` once at the start of each session before using other tools. Once configured, you can use all other tools without reconfiguring.

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
