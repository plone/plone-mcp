# Readme for AI Assistant Agents

This whole file contains help for AI Assistant Agents and should not be deleted.

## Project Overview

This project is a Model Context Protocol (MCP) server designed to integrate MCP clients with a Plone CMS via its REST API. It provides a comprehensive set of tools for managing Plone content. The server is built with Node.js and TypeScript, using the official `@modelcontextprotocol/sdk`. It handles HTTP (via Express/SSE) and STDIO transports, and uses `zod` for schema validation.

## Development Conventions

- **Entry Points:** The server has two main entry points:
    - `src/http-server.ts`: Runs the server as an HTTP/Express application with stateful session management.
    - `src/stdio-server.ts`: Runs the server for local STDIO-based clients (like Claude Desktop).
- **Core Logic:** The logic is split into:
    - `src/server.ts`: Central registry for tools, resources, and prompts.
    - `src/plone-service.ts`: Domain logic, Volto block processing, and temporary state management.
    - `src/plone-client.ts`: Low-level axios-based HTTP client for Plone REST API.
    - `src/session-manager.ts`: Manages multi-user sessions (especially for HTTP transport).
- **Tools & Resources:** Tools are modularized in `src/tools/` and resources in `src/resources/`. Each tool/resource is a self-contained object with configuration (zod schema) and a handler.
- **Configuration:** Plone connection details can be provided via tool arguments or environment variables:
    - `PLONE_BASE_URL`: Base URL of the Plone site.
    - `PLONE_USERNAME`, `PLONE_PASSWORD`: Basic auth credentials.
    - `PLONE_TOKEN`: JWT authentication token.
    - `PLONE_PREPARED_BLOCKS_TTL`: TTL for draft block layouts (default: 60,000ms).
    - `PLONE_SESSION_TTL`: Inactivity timeout for HTTP sessions (default: 3,600,000ms).
- **Block Management:** Sophisticated logic for Volto blocks (Slate, Teaser, Grid, etc.) is found in `src/utils/block-utils.ts`. It includes Markdown-to-Slate conversion using `remark`.
- **Error Handling:** Use the `wrapError` utility from `src/utils/block-utils.ts` for all handlers to ensure consistent, descriptive error messages across the MCP interface.

## Important Reminders

- **Validation:** Always run tests (`make test`), type-checking (`make type-check`), and build (`make build`) before finalizing changes.
- **Critical**: Tests should be run using `make test`.
- **Formatting**: Format code with `make format` before committing.
- **Multi-session**: Remember that `SessionManager` isolates state. When working with HTTP transport, always use the `sessionId` from the handler's `extra` parameter.
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
