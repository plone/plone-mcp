# Plone MCP Server

A Model Context Protocol (MCP) server for integrating MCP clients with Plone CMS via REST API. Enables content management, search, workflow operations, and Volto blocks management.

## Table of Contents

- [Quick Start](#quick-start-using-claude-desktop-as-an-example)
- [Configuration](#configuration)
- [Security Best Practices](#security-best-practices)
- [Core Features](#core-features)
- [Essential Tools](#essential-tools)
- [Block Management](#block-management)
- [Development](#development)

## Quick Start using Claude Desktop as an example

1. **Install**
```bash
git clone git@github.com:kitconcept/plone-mcp.git
cd plone-mcp
pnpm run build
```

2. **Configure Claude Desktop**

Add to Claude's configuration file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Recommended: With Environment Variables (Secure)**
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

**Alternative: Without Environment Variables**
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
Then configure at runtime:
```javascript
plone_configure({
  "baseUrl": "https://demo.plone.org",
  "username": "admin",
  "password": "admin"
})
```

3. **Restart Claude Desktop**

4. **Start Using** - If you configured environment variables, you can start using tools immediately. Otherwise, run `plone_configure` first.

## Configuration

Plone MCP Server supports two methods for providing credentials:

### Method 1: Environment Variables (Recommended)

Configure credentials securely using environment variables in your Claude Desktop configuration:

**macOS/Linux:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

**Available Environment Variables:**
- `PLONE_BASE_URL` - Base URL of your Plone site (required)
- `PLONE_USERNAME` - Username for authentication (required)
- `PLONE_PASSWORD` - Password for authentication (required)

When using environment variables, you can call `plone_configure({})` without parameters, or call tools directly - the server will auto-configure on first use.

### Method 2: Runtime Parameters

Alternatively, provide credentials at runtime via the `plone_configure` tool:

```javascript
plone_configure({
  "baseUrl": "https://demo.plone.org",
  "username": "admin",
  "password": "admin"
})
```

**Note:** Runtime parameters take precedence over environment variables, allowing you to override the default configuration.

### Multiple Plone Instances

To connect to multiple Plone instances, configure separate MCP server entries:

```json
{
  "mcpServers": {
    "plone-demo": {
      "command": "node",
      "args": ["/path/to/plone-mcp/dist/index.js"],
      "env": {
        "PLONE_BASE_URL": "https://demo.plone.org",
        "PLONE_USERNAME": "admin",
        "PLONE_PASSWORD": "admin"
      }
    },
    "plone-production": {
      "command": "node",
      "args": ["/path/to/plone-mcp/dist/index.js"],
      "env": {
        "PLONE_BASE_URL": "https://plone.example.com",
        "PLONE_USERNAME": "editor",
        "PLONE_PASSWORD": "your-password"
      }
    }
  }
}
```

## Security Best Practices

### Credential Storage

**✅ DO:**
- Store credentials in environment variables (Claude Desktop config)
- Use HTTPS URLs only (never HTTP for production)
- Restrict file permissions on configuration files: `chmod 600 claude_desktop_config.json`
- Create dedicated user accounts with minimal required permissions for MCP access
- Rotate credentials regularly
- Use different credentials for production/staging/development

**❌ DON'T:**
- Hard-code credentials in scripts or code
- Share credentials via chat or unencrypted channels
- Use production credentials in development environments
- Commit configuration files with credentials to version control
- Use overly permissive user accounts (avoid using admin for MCP access)

### File Permissions

Ensure your Claude Desktop configuration file has restricted permissions:

```bash
# macOS/Linux
chmod 600 ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Verify
ls -la ~/Library/Application\ Support/Claude/claude_desktop_config.json
# Should show: -rw------- (only owner can read/write)
```

### Network Security

- Always use HTTPS for production Plone sites
- Validate SSL/TLS certificates (don't skip verification)
- Use firewall rules to restrict MCP server network access if needed
- Consider using VPN for accessing internal Plone instances

### Credential Best Practices

1. **Generation**: Use strong, unique passwords for each environment
2. **Storage**: Store in environment variables, never in code
3. **Permissions**: Create MCP-specific Plone users with only the permissions needed (Editor, Contributor, etc.)
4. **Rotation**: Update credentials regularly (30-90 days)
5. **Revocation**: Immediately revoke compromised credentials

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
plone_configure({baseUrl: "https://demo.plone.org", username: "admin", password: "admin"})

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

⚠️ **Configuration** - Either set environment variables in Claude Desktop config (recommended) or run `plone_configure` before operations.

⚠️ **Security** - Never commit credentials to version control. Use environment variables and restrict file permissions.

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
| "Plone client not configured" | Set environment variables in Claude Desktop config or call `plone_configure` |
| "baseUrl is required" | Set `PLONE_BASE_URL` environment variable or provide `baseUrl` parameter |
| "Authentication required" | Set `PLONE_USERNAME` and `PLONE_PASSWORD` environment variables |
| "Block not found" | Use `plone_get_content` to get valid block IDs |
| Connection errors | Check Plone URL, credentials, and network connectivity. Verify HTTPS is used. |
| Blocks not applied | Ensure you use them within 60 seconds |
| Environment variables not loaded | Restart Claude Desktop after updating configuration file |

## Resources

- [Plone REST API Documentation](https://plonerestapi.readthedocs.io/)
- [MCP Documentation](https://modelcontextprotocol.io/docs)

## License

MIT
