# Plone MCP Server

A Model Context Protocol (MCP) server that provides integration with Plone CMS REST API. This server allows Claude and other MCP clients to interact with Plone sites for content management, search, workflow operations, and more.

## Features

- **Content Management**: Create, read, update, and delete content
- **Search**: Full-text search across Plone content
- **Workflow**: View workflow states and execute transitions
- **Site Information**: Access site configuration and available content types
- **Vocabularies**: Query Plone vocabularies for form fields
- **Authentication**: Support for both JWT tokens and basic authentication

## Installation

```bash
npm install
npm run build
```

## Usage

### With Claude Desktop

Add the following to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "plone": {
      "command": "node",
      "args": ["/path/to/plone-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

### Configuration

Before using any other tools, configure the connection to your Plone site:

```
plone_configure({
  "baseUrl": "https://your-plone-site.com",
  "username": "admin",
  "password": "secret"
})
```

Or with JWT token:

```
plone_configure({
  "baseUrl": "https://your-plone-site.com",
  "token": "your-jwt-token"
})
```

## Available Tools

### Core Tools

- **plone_configure**: Configure connection to Plone site
- **plone_get_site_info**: Get information about the Plone site

### Content Management

- **plone_get_content**: Get content by path, with optional component expansion
- **plone_create_content**: Create new content (Documents, Folders, News Items, etc.)
- **plone_update_content**: Update existing content
- **plone_delete_content**: Delete content

### Search and Discovery

- **plone_search**: Search for content with filters and sorting
- **plone_get_types**: Get available content types
- **plone_get_vocabularies**: Query vocabulary values

### Workflow

- **plone_get_workflow_info**: Get workflow information for content
- **plone_transition_workflow**: Execute workflow transitions

## Examples

### Get Site Information
```
plone_get_site_info()
```

### Create a Document
```
plone_create_content({
  "parentPath": "/news",
  "type": "Document",
  "title": "My New Document",
  "description": "A sample document",
  "text": "<p>This is the body text</p>"
})
```

### Search for Content
```
plone_search({
  "query": "news",
  "portal_type": ["News Item", "Document"],
  "sort_on": "modified",
  "sort_order": "descending"
})
```

### Get Content with Expanded Components
```
plone_get_content({
  "path": "/news/my-document",
  "expand": ["breadcrumbs", "workflow", "actions"]
})
```

### Execute Workflow Transition
```
plone_transition_workflow({
  "path": "/news/my-document",
  "transition": "publish",
  "comment": "Ready for publication"
})
```

## Development

```bash
# Development mode
npm run dev

# Build
npm run build

# Start built server
npm start
```

## API Reference

Based on the official Plone REST API documentation: https://plonerestapi.readthedocs.io/

The server implements the following endpoint patterns:
- `GET /++api++/path/to/content` - Get content
- `POST /++api++/path/to/parent` - Create content  
- `PATCH /++api++/path/to/content` - Update content
- `DELETE /++api++/path/to/content` - Delete content
- `GET /++api++/@search` - Search content
- `GET /++api++/path/to/content/@workflow` - Get workflow info
- `POST /++api++/path/to/content/@workflow/transition` - Execute transition
- `GET /++api++/@types` - Get content types
- `GET /++api++/@vocabularies/vocab-name` - Get vocabulary

## License

MIT