# Plone MCP Server

A Model Context Protocol (MCP) server for integrating MCP clients with Plone CMS via REST API. Enables content management, search, workflow operations, and Volto blocks management.

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

4. **Connect to Plone** (by requesting it to Claude, while providing necessary url and credentials)
```javascript
plone_configure({
  "baseUrl": "https://demo.plone.org",
  "username": "admin",
  "password": "admin"
})
```

## Prerequisites

- Node.js 18+
- pnpm 8+
- Plone 6.0+ site with REST API

## Core Features

- **Content Management**: CRUD operations on all Plone content types
- **Block System**: Create and manage Volto blocks
- **Search**: Full-text search with filtering and sorting
- **Workflow**: Manage publication states and transitions
- **Site Info**: Access content types, vocabularies, and site configuration

## Essential Tools

| Tool | Description | Example |
|------|-------------|---------|
| `plone_configure` | Connect to Plone (required first) | `plone_configure({baseUrl, username, password})` |
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

⚠️ **Always configure first** - Run `plone_configure` before any other operations in each session.

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
| "Plone client not configured" | Run `plone_configure` first |
| "Block not found" | Use `plone_get_content` to get valid block IDs |
| Connection errors | Check Plone URL and credentials |
| Blocks not applied | Ensure you use them within 60 seconds |

## Resources

- [Plone REST API Documentation](https://plonerestapi.readthedocs.io/)
- [MCP Documentation](https://modelcontextprotocol.io/docs)

## License

MIT
