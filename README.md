# Plone MCP Server

Talk to your Plone website instead of clicking through it. Plone MCP lets AI assistants like Claude create and edit pages, publish content, search the site, and manage translations on your behalf, in plain language - no coding required to use it, and nothing to change on your Plone site to enable it.

It's built on the [Model Context Protocol](https://modelcontextprotocol.io/docs) (MCP), an open standard that lets AI assistants safely connect to external tools and data. Plone MCP exposes Plone's REST API as a set of MCP tools, so any MCP-compatible client - Claude Desktop, Claude Code, and others - can drive your site, and developers can script, automate, or build on top of the same tools.

## Quickstart

Requires [Node.js 22+](https://nodejs.org). Add this to Claude Desktop's config file, then restart Claude Desktop:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "plone": {
      "command": "npx",
      "args": ["-y", "@plone/mcp"],
      "env": {
        "PLONE_BASE_URL": "https://demo.plone.org",
        "PLONE_USERNAME": "admin",
        "PLONE_PASSWORD": "admin"
      }
    }
  }
}
```

Claude can now work with that Plone site.

## Prerequisites

- **Node.js 22+** - Required to run the server (`^20.19.0 || >=22.12.0`; install: `brew install node` on macOS or from [nodejs.org](https://nodejs.org))

- **Plone 6.0+** site with REST API - The CMS you'll be connecting to. Sign-in over HTTP needs Plone 6.2+ with `pas.plugins.identity` (see [Sign-in over HTTP](#sign-in-over-http))

> `pnpm` is only needed if you want to clone the repo and develop locally (see [Local Development](#local-development)). The recommended setup below uses `npx` and doesn't require cloning anything.

## Transports

The server speaks MCP `2026-07-28` and still serves 2025-era clients. It is stateless: there are no sessions, so any instance can answer any request and restarts are invisible to clients.

- **STDIO** (`plone-mcp` bin / `dist/stdio-server.js`) - for local MCP clients such as Claude Desktop. The process exits when stdin closes.
- **HTTP** (`dist/http-server.js`) - streamable HTTP at `/mcp`, listening on `HOST` (default `127.0.0.1`; use `0.0.0.0` in containers) and `PORT` (default `3001`). Start it with `make start`. Only `POST` is used; `GET` and `DELETE` answer `405`. It requires sign-in, see [Sign-in over HTTP](#sign-in-over-http), and does not start without it.
- **Handler** (`@plone/mcp/handler`) - the same HTTP endpoint as a web-standard `fetch(Request) -> Response` function, for serverless platforms:

  ```javascript
  import { handler } from "@plone/mcp/handler";
  export default { fetch: (request) => handler.fetch(request) };
  ```

  The handler loads `blocks.json` from disk, so it needs a Node.js runtime (not an edge runtime).

Browsers may only call the HTTP endpoint from `localhost` pages, or from origins listed in `PLONE_MCP_ALLOWED_ORIGINS` (comma-separated, e.g. `https://cms.example.org`). Other origins get `403`.

## Sign-in over HTTP

Over HTTP every user signs in to Plone with OAuth and the server acts as that user: Plone applies their permissions and records their name on every change. No credentials are configured on the server.

This needs the Plone site to be an OAuth authorization server, which a standard Plone or Volto site is not. It takes the [`pas.plugins.identity`](https://github.com/collective/pas-plugins-identity) add-on with its `server` layer (Plone 6.2+, alpha). Without it, use STDIO, or the [shared-account fallback](#without-oauth).

**On the Plone site** (site administrator):

1. Install `pas.plugins.identity[server]` and activate the `pas.plugins.identity:default` and `pas.plugins.identity.server:default` profiles. Users and groups become content, so back up first.
2. Set the issuer to the site's public URL, e.g. `https://plone.example.com/Plone`. Leave the consent URL empty for Plone's own consent page, or point it at the Volto add-on's route.
3. Register one OAuth client per MCP client app, with its exact redirect URI (the port must match too). For Claude Code: client id `plone-mcp-claude-code`, redirect `http://localhost:8765/callback`, grants `authorization_code` and `refresh_token`.
4. Route the sign-in paths to the backend in the proxy: `/.well-known/openid-configuration`, `@@oauth-*`, the login page and the consent page. A Volto proxy usually forwards only `++api++`.

**On the MCP server** (one server per Plone site):

| Variable | Example | Meaning |
|---|---|---|
| `PLONE_BASE_URL` | `https://plone.example.com/Plone` | The Plone site |
| `PLONE_OAUTH_ISSUER` | `https://plone.example.com/Plone` | The issuer set in Plone, exactly; `https` except on localhost |
| `PLONE_OAUTH_ALLOWED_CLIENT_IDS` | `plone-mcp-claude-code,plone-mcp-inspector` | Client ids whose tokens are accepted |
| `PLONE_MCP_RESOURCE_URL` | `https://mcp.example.com/mcp` | This server's public URL, exactly as users enter it |

Do not set `PLONE_USERNAME`, `PLONE_PASSWORD` or `PLONE_TOKEN` here. Put the server behind HTTPS.

**In the client:**

```bash
claude mcp add --transport http plone https://mcp.example.com/mcp \
  --client-id plone-mcp-claude-code --callback-port 8765
```

Then run `/mcp` in Claude Code: a browser opens on the Plone login, then the consent page. Any MCP client that supports OAuth with a preset client id works the same way. Clients that only support dynamic client registration do not, because the add-on has none.

**How it behaves:**

- The server publishes [Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728) at `/.well-known/oauth-protected-resource/mcp`, pointing at Plone. A request without a valid token answers `401` with a `WWW-Authenticate` header that leads the client there.
- Tokens are checked locally against Plone's published keys: signature (RS256), issuer, expiry, type and client id. A token with less than a minute left is refused up front, so the client renews it before a tool starts.
- If Plone stops accepting a token mid-session (client disabled, keys rotated), the request answers `401` and the client refreshes and retries. A Plone `401` or `403` for a missing permission is a tool error.
- Plone redirects to another origin are not followed, so the token only goes to `PLONE_BASE_URL`.

**Deviation from the MCP specification:** the specification says a server must not pass the token it received on to another service. This server does pass it to Plone, because the token's issuer and the API are the same Plone site, and `pas.plugins.identity` cannot yet issue a token meant for this server alone. The token never goes anywhere else.

### Without OAuth

`PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP=true` makes the HTTP server use the `PLONE_*` credentials for requests that carry no token. **Every caller then acts as that one Plone account**, so keep the endpoint on localhost or a private network and give the account as few rights as possible. A request with a bad token is still refused. With neither OAuth nor this setting, the HTTP server does not start.

## Quick Start using Claude Desktop as an example

The [`@plone/mcp`](https://www.npmjs.com/package/@plone/mcp) package is published on npm, so there's nothing to install or build - `npx` fetches and runs it on demand.

1. **Configure Claude Desktop**

Add to Claude's configuration file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Credentials come from environment variables. For several Plone sites, add one server entry per site.

```json
{
  "mcpServers": {
    "plone": {
      "command": "npx",
      "args": ["-y", "@plone/mcp"],
      "env": {
        "PLONE_BASE_URL": "https://demo.plone.org",
        "PLONE_USERNAME": "admin",
        "PLONE_PASSWORD": "admin"
      }
    }
  }
}
```

Use `PLONE_TOKEN` instead of `PLONE_USERNAME` and `PLONE_PASSWORD` to authenticate with a JWT token from Plone's `@login` endpoint. The token expires (12 hours by default), so for long-running use the username and password are simpler.

2. **Restart Claude Desktop**

## Local Development

Clone the repo if you want to modify the server, debug it, or run it with the MCP Inspector:

```bash
git clone https://github.com/plone/plone-mcp.git
cd plone-mcp
make install
make build
```

Point Claude Desktop at your local build instead of the `npx` command:

```json
{
  "mcpServers": {
    "plone": {
      "command": "node",
      "args": ["/absolute/path/to/plone-mcp/dist/stdio-server.js"],
      "env": {
        "PLONE_BASE_URL": "http://localhost:8080/Plone",
        "PLONE_USERNAME": "admin",
        "PLONE_PASSWORD": "admin"
      }
    }
  }
}
```

Development commands:

```bash
# Install the dependencies
make install

# Build for production (compiles TypeScript and copies blocks.json)
make build

# Run the HTTP server / the STDIO server from the build
make start
make stdio

# Debug with the MCP Inspector
make inspector

# Tests (Vitest)
make test-all       # everything
make test           # unit tests only
make test-coverage  # with coverage

# Static checks
make lint           # ESLint over src/ and __tests__/
make format         # ESLint with --fix
make type-check     # tsc over sources and tests
```

Run `make help` to list every available target.

## Core Features

- **Content Management**: CRUD operations on all Plone content types
- **Block System**: Create and manage Volto blocks
- **Search**: Full-text search with filtering and sorting
- **Workflow**: Manage publication states and transitions
- **Site Info**: Access content types, vocabularies, and site configuration

## Essential Tools

| Tool                        | Description                              | Example                                                                                |
| --------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `plone_get_content`         | Get content by path                      | `plone_get_content({path: "/news"})`                                                   |
| `plone_create_content`      | Create new content                       | `plone_create_content({parentPath: "/", type: "Document", title: "Page"})`             |
| `plone_update_content`      | Update existing content                  | `plone_update_content({path: "/page", title: "New Title"})`                            |
| `plone_delete_content`      | Delete content                           | `plone_delete_content({path: "/old-page"})`                                            |
| `plone_copy_content`        | Copy content into a container            | `plone_copy_content({parentPath: "/archive", source: "/news"})`                        |
| `plone_move_content`        | Move content into a container            | `plone_move_content({parentPath: "/archive", source: "/old-page"})`                    |
| `plone_search`              | Search content                           | `plone_search({query: "news", portal_type: ["Document"]})`                             |
| `plone_transition_workflow` | Change workflow state                    | `plone_transition_workflow({path: "/page", transition: "publish"})`                    |
| `plone_get_navigation_tree` | Get hierarchical site structure          | `plone_get_navigation_tree({root_path: "/", depth: 2})`                                |
| `plone_get_translation`     | List translations of a content item      | `plone_get_translation({path: "/en/my-page"})`                                         |
| `plone_link_translation`    | Link existing content as a translation   | `plone_link_translation({path: "/en/my-page", id: "/de/meine-seite"})`                 |
| `plone_unlink_translation`  | Remove a translation link                | `plone_unlink_translation({path: "/en/my-page", language: "de"})`                      |
| `plone_create_working_copy` | Check out content into a working copy    | `plone_create_working_copy({path: "/my-document"})`                                    |
| `plone_get_working_copy`    | Show working copy relationship and lock  | `plone_get_working_copy({path: "/my-document"})`                                       |
| `plone_checkin_working_copy`| Check in a working copy                  | `plone_checkin_working_copy({path: "/working_copy_of_my-document"})`                   |
| `plone_cancel_working_copy` | Discard a working copy                   | `plone_cancel_working_copy({path: "/working_copy_of_my-document"})`                    |

## Block Management

### Creating Content with Blocks

```javascript
// Blocks are converted and saved in the same call
plone_create_content({
  parentPath: "/",
  type: "Document",
  title: "Homepage",
  block_specs: [
    {
      type: "text",
      data: { text: "Welcome to our site!" },
    },
    {
      type: "teaser",
      data: {
        href: "/about",
        title: "Learn More",
        description: "Discover what we do",
      },
    },
  ],
});

// Optional: check block specs without saving anything
plone_validate_blocks({
  block_specs: [{ type: "text", data: { text: "Welcome to our site!" } }],
});
```

### Managing Individual Blocks

```javascript
// Add a single block
plone_add_single_block({
  path: "/homepage",
  blockType: "text",
  blockData: { text: "New paragraph" },
  position: 1,
});

// Update a block
plone_update_single_block({
  path: "/homepage",
  blockId: "51176ead-7b59-402d-9412-baed46821b36", // Get ID from plone_get_content
  blockData: { text: "Updated text" },
});

// Remove a block
plone_remove_single_block({
  path: "/homepage",
  blockId: "51176ead-7b59-402d-9412-baed46821b36",
});
```

## Available Block Types

- **text**: Rich text content
- **teaser**: Link preview card with image
- **\__button**: Call-to-action button
- **separator**: Visual divider line

Use `plone_get_block_schemas()` to see all block types and their properties.

## Common Workflows

### Create and Publish a Page

```javascript
// Create with blocks
plone_create_content({
  parentPath: "/news",
  type: "News Item",
  title: "Breaking News",
  block_specs: [{ type: "text", data: { text: "Article content..." } }],
});

// Publish
plone_transition_workflow({
  path: "/news/breaking-news",
  transition: "publish",
});
```

### Copy and Move Content

```javascript
// Copy one or more items into another folder (originals stay in place)
plone_copy_content({
  parentPath: "/archive",
  source: ["/news/breaking-news", "/news/annual-report"],
});

// Move an item, removing it from its current location
plone_move_content({
  parentPath: "/archive",
  source: "/old-page",
});
```

### Search and Filter

```javascript
plone_search({
  query: "annual report",
  portal_type: ["Document", "File"],
  review_state: ["published"],
  sort_on: "modified",
  sort_order: "descending",
  b_size: 10,
});
```

## Troubleshooting

| Issue                                | Solution                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `command not found` when using `npx` | Make sure the `args` in your config use `plone-mcp` as the binary name (not `plone-mcp-server`) — this was renamed in the package. |
| "Base URL is required"               | Set `PLONE_BASE_URL` in the server's `env` configuration                                                                           |
| "Block not found"                    | Use `plone_get_content` to get valid block IDs                                                                                     |
| "Could not reach Plone at ..."       | Check that Plone is running and `PLONE_BASE_URL` is correct                                                                        |
| "Not authorized by Plone (HTTP 401/403)" | Check the credentials and that the Plone user has permission for that content                                                  |
| "Plone MCP Server (HTTP) not started" | Configure [sign-in](#sign-in-over-http), or set `PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP=true` |
| `500` "MCP server not configured"     | The handler's sign-in settings are incomplete; the server log names the variable |
| Client keeps asking to sign in       | Check that the client id is in `PLONE_OAUTH_ALLOWED_CLIENT_IDS`, is enabled in Plone, and that `PLONE_OAUTH_ISSUER` equals Plone's issuer |
| `403` "Origin not allowed"           | Add the browser page's origin to `PLONE_MCP_ALLOWED_ORIGINS`                                                                       |
| "block_specs[N] (type): ..."         | Fix the block spec at index N (see `plone_get_block_schemas`) and repeat the call                                                  |
| TypeScript errors during local build | Run `make install` to ensure all dependencies are installed                                                                        |

## Resources

- [Plone REST API Documentation](https://plonerestapi.readthedocs.io/)
- [MCP Documentation](https://modelcontextprotocol.io/docs)

## License

MIT
