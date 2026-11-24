# Readme for AI Assistant Agents

This whole file contains help for AI Assistant Agents and should not be deleted.

## Project Overview

This project is a Model Context Protocol (MCP) server designed to integrate MCP clients with a Plone CMS via its REST API. It provides a comprehensive set of tools for managing Plone content. The server is built with Node.js and TypeScript, using the official MCP TypeScript SDK v2 (`@modelcontextprotocol/server`). It speaks MCP 2026-07-28 and still serves 2025-era clients, over HTTP and STDIO, and uses `zod` for schema validation. It is stateless: nothing is kept between requests.

## Development Conventions

- **Entry Points:** The server has two main entry points:
    - `src/http-server.ts`: Thin Express wrapper around `src/handler.ts`; listens on `HOST`/`PORT` at `/mcp`.
    - `src/stdio-server.ts`: Runs the server for local STDIO-based clients (like Claude Desktop) via `serveStdio`.
- **Core Logic:** The logic is split into:
    - `src/handler.ts`: Web-standard `Request` -> `Response` handler (`createMcpHandler`), exported as `@plone/mcp/handler` for serverless deployments. Builds a fresh server per request and checks `Origin`.
    - `src/server.ts`: Central registry for tools, resources, and prompts, plus cache hints.
    - `src/auth/http-auth.ts`: HTTP sign-in: Protected Resource Metadata, the Bearer check and its `401` challenge.
    - `src/auth/verifier.ts`: Verifies Plone access tokens locally with `jose` (keys cached per issuer), and asks Plone's userinfo endpoint whether a token is still accepted.
    - `src/connection.ts`: Builds the Plone client for each request, from the request's access token or the environment. Nothing is kept between requests. The token is passed on to Plone; this is a documented deviation from the MCP spec.
    - `src/plone-client.ts`: Low-level axios-based HTTP client for Plone REST API.
- **Tools & Resources:** Tools are modularized in `src/tools/` and resources in `src/resources/`. Each tool/resource is a self-contained object with configuration (zod schema) and a handler.
- **Configuration:** Plone connection details come from environment variables:
    - `PLONE_BASE_URL`: Base URL of the Plone site.
    - `PLONE_USERNAME`, `PLONE_PASSWORD`: Basic auth credentials.
    - `PLONE_TOKEN`: JWT authentication token.
    - `PLONE_OAUTH_ISSUER`, `PLONE_OAUTH_ALLOWED_CLIENT_IDS`, `PLONE_MCP_RESOURCE_URL`: OAuth sign-in over HTTP through `pas.plugins.identity` (see README).
    - `PLONE_ALLOW_ENV_CREDENTIALS_OVER_HTTP`: `true` lets HTTP requests without an access token use the credentials above. Without it or OAuth, the HTTP server refuses to start.
    - `HOST` (default `127.0.0.1`), `PORT` (default `3001`): HTTP server address.
    - `PLONE_MCP_ALLOWED_ORIGINS`: Comma-separated browser origins allowed besides localhost.
- **Block Management:** Sophisticated logic for Volto blocks (Slate, Teaser, Grid, etc.) is found in `src/utils/block-utils.ts`. It includes Markdown-to-Slate conversion using `remark`.
- **Tool Results:** Build every tool result with `toolResult(value, text?)` from `src/utils/tool-result.ts`. It returns `value` as `structuredContent` and as JSON text (or the given text), so the two never drift apart. Declare an `outputSchema` only when the result's shape is stable; keep it shallow (field names and types, no descriptions) and require only fields Plone always returns, because the SDK fails a call whose result does not match.
- **Error Handling:** Use the `wrapError` utility from `src/utils/block-utils.ts` for all handlers to ensure consistent, descriptive error messages across the MCP interface. A thrown tool error reaches the client as `isError: true`. `PloneClient` throws `PloneRequestError` with the HTTP `status`; resources turn a Plone 404 into `ResourceNotFoundError` (`-32602`). Do not hardcode JSON-RPC codes.

## Important Reminders

- **Validation:** Always run tests (`make test`), type-checking (`make type-check`), and build (`make build`) before finalizing changes.
- **Critical**: Tests should be run using `make test`.
- **Formatting**: Format code with `make format` before committing.
- **Stateless**: Never keep state between requests (no session ids, module-level caches of user data, or timers; ESLint enforces part of this). Get the Plone client with `getClient(ctx)` inside each handler.
- **Security**: Always use `client.normalizePath()` in tools/resources; it includes built-in path traversal protection.
- **Commit Policy**: Never trigger a `git commit` unless the user explicitly asked for it.

For more details read [README.md](./README.md) and [TESTING.md](./TESTING.md)

## Makefile Targets

- `all`: Show help.
- `build`: Compile TypeScript to JavaScript.
- `dev`: Run with hot-reloading for development.
- `format`: Format code using Prettier.
- `test`: Run all tests.
- `type-check`: Run TypeScript type checking.
- `lint`: Run ESLint (if configured).

## Important Agent Behavior Guidelines

- **File Deletion Policy**: Never delete any files unless explicitly instructed by the user. Always confirm with the user before performing any deletion actions.
- **Respect All Files**: Do not assume any file is unnecessary. Always inquire with the user before taking any action on "unused" or "stale" files.
- **Surgical Edits**: Prefer `replace` over `write_file` for existing files to maintain surrounding context and style.
