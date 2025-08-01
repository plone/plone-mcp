# Plone MCP Server

A Model Context Protocol (MCP) server that provides integration with Plone CMS REST API. This server allows Claude and other MCP clients to interact with Plone sites for content management, search, workflow operations, and comprehensive Volto blocks support.

## Features

- **Content Management**: Create, read, update, and delete content
- **Volto Blocks Support**: Full support for Plone 6 blocks-based content editing
- **Block Management**: Add, update, and remove individual blocks from content
- **Rich Block Types**: Support for all major Volto block types (text, image, teaser, listing, etc.)
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

Add the following to your Claude Desktop configuration (on OSX: ~/Library/Application Support/Claude/claude_desktop_config.json):

```json
{
  "mcpServers": {
    "plone": {
      "command": "/Users/timo/.nvm/versions/node/v22.15.0/bin/node",
      "args": ["/path/to/plone-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

Amend the path in the config to your actual path (e.g. vi "/Users/timo/workspace/kitconcept/plone-mcp/dist/index.js").

Amend the Node version you are using to the path to your actual node version (e.g. "/Users/timo/.nvm/versions/node/v22.15.0/bin/node").

An example of a working version might look like this:

```
{
  "mcpServers": {
    "plone": {
      "command": "/Users/timo/.nvm/versions/node/v22.15.0/bin/node",
      "args": ["/Users/timo/workspace/kitconcept/plone-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

Then restart Claude Desktop.

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
- **plone_create_content**: Create new content (Documents, Folders, News Items, etc.) with optional blocks support
- **plone_update_content**: Update existing content with optional blocks support
- **plone_delete_content**: Delete content

### Volto Blocks Management

- **plone_create_blocks_content**: Create new content with a complete blocks structure
- **plone_add_block**: Add a single block to existing content
- **plone_update_block**: Update a specific block in content
- **plone_remove_block**: Remove a specific block from content

### Block Creation Helpers

- **plone_create_text_block**: Create a rich text (Slate) block with formatted content
- **plone_create_image_block**: Create an image block with size and alignment options
- **plone_create_teaser_block**: Create a teaser block with links and preview images
- **plone_create_listing_block**: Create a content listing block with query and template options

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

### Create a Document with Blocks
```
plone_create_blocks_content({
  "parentPath": "/news",
  "type": "Document",
  "title": "My New Document",
  "description": "A sample document",
  "blocksData": [
    {
      "blockType": "slate",
      "data": {
        "value": [{"type": "p", "children": [{"text": "Welcome to our new document!"}]}],
        "plaintext": "Welcome to our new document!"
      }
    },
    {
      "blockType": "image",
      "data": {
        "url": "/path/to/image.jpg",
        "alt": "Sample image",
        "size": "l",
        "align": "center"
      }
    }
  ]
})
```

### Add a Block to Existing Content
```
plone_add_block({
  "path": "/news/my-document",
  "blockType": "teaser",
  "blockData": {
    "href": "/related-page",
    "title": "Related Article",
    "description": "Check out this related content"
  },
  "position": 1
})
```

### Create Individual Block Types
```
// Create a text block
plone_create_text_block({
  "text": "This is a rich text block",
  "format": "plain"
})

// Create an image block
plone_create_image_block({
  "imageUrl": "/path/to/image.jpg",
  "alt": "Description of image",
  "caption": "Image caption",
  "size": "l",
  "align": "center"
})

// Create a listing block
plone_create_listing_block({
  "query": [
    {"i": "portal_type", "o": "plone.app.querystring.operation.selection.any", "v": ["News Item"]}
  ],
  "sort_on": "modified",
  "sort_order": "descending",
  "limit": 5,
  "template": "summary"
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
