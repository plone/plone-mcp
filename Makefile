### Defensive settings for make:
#     https://tech.davis-hansson.com/p/make/
#
# NOTE: `.ONESHELL:` and `.SHELLFLAGS:` require GNU Make 3.82+. macOS ships
# 3.81, which silently ignores both, so recipes run strict on Linux CI but
# permissive locally. Keep every recipe line self-contained, or join multi-line
# constructs with `; \`, rather than relying on shared shell state.
SHELL:=bash
.ONESHELL:
.SHELLFLAGS:=-eu -o pipefail -c
.SILENT:
.DELETE_ON_ERROR:
MAKEFLAGS+=--warn-undefined-variables
MAKEFLAGS+=--no-builtin-rules

# Branch the changelog gate compares against. Override with:
#     make check-changelog BASE_BRANCH=origin/some-branch
BASE_BRANCH?=origin/main

# Recipe snippets for reuse

# We like colors
# From: https://coderwall.com/p/izxssa/colored-makefile-for-golang-projects
RED=`tput setaf 1`
GREEN=`tput setaf 2`
RESET=`tput sgr0`
YELLOW=`tput setaf 3`


.PHONY: help
help: ## Show this help
	echo -e "$$(grep -hE '^\S+:.*##' $(MAKEFILE_LIST) | sed -e 's/:.*##\s*/:/' -e 's/^\(.\+\):\(.*\)/\\x1b[36m\1\\x1b[m:\2/' | column -c2 -t -s :)"


# Dev Helpers
.PHONY: clean
clean: ## Remove node_modules and dist (`make install` is needed afterwards)
	echo "$(YELLOW)==> Removing node_modules and dist$(RESET)"
	rm -rf node_modules dist

.PHONY: install
install: ## Install the project dependencies with pnpm
	echo "$(GREEN)==> Installing dependencies$(RESET)"
	pnpm i

.PHONY: build
build: ## Compile the TypeScript sources to dist/
	echo "$(GREEN)==> Building dist/$(RESET)"
	pnpm build

.PHONY: start
start: ## Start the MCP HTTP server from dist/ (run `make build` first)
	echo "$(GREEN)==> Starting the MCP HTTP server$(RESET)"
	pnpm start

.PHONY: stdio
stdio: ## Start the MCP STDIO server from dist/ (run `make build` first)
	echo "$(GREEN)==> Starting the MCP STDIO server$(RESET)"
	pnpm run stdio

.PHONY: inspector
inspector: ## Debug the STDIO server with the MCP Inspector (run `make build` first)
	echo "$(GREEN)==> Starting the MCP Inspector$(RESET)"
	npx @modelcontextprotocol/inspector node dist/stdio-server.js

.PHONY: format
format: ## Format the codebase, fixing every auto-fixable lint problem
	echo "$(GREEN)==> Formatting the codebase$(RESET)"
	pnpm lint:fix

.PHONY: lint
lint: ## Report lint problems in the codebase without modifying it
	echo "$(GREEN)==> Linting the codebase$(RESET)"
	pnpm lint

.PHONY: type-check
type-check: ## Type-check the sources and the tests without emitting output
	echo "$(GREEN)==> Type-checking sources and tests$(RESET)"
	pnpm run type-check


# Tests
.PHONY: test
test: ## Run the unit tests
	echo "$(GREEN)==> Running the unit tests$(RESET)"
	pnpm run test:unit

.PHONY: test-all
test-all: ## Run the whole test suite (unit and integration)
	echo "$(GREEN)==> Running the whole test suite$(RESET)"
	pnpm test

.PHONY: test-integration
test-integration: ## Run the integration tests
	echo "$(GREEN)==> Running the integration tests$(RESET)"
	pnpm run test:integration

.PHONY: test-coverage
test-coverage: ## Run the whole test suite and report coverage
	echo "$(GREEN)==> Running the test suite with coverage$(RESET)"
	pnpm run test:coverage


# Changelog
.PHONY: changelog
changelog: ## Preview the changelog the next release would generate
	echo "$(GREEN)==> Generating draft changelog$(RESET)"
	uvx towncrier build --draft --yes --version 'unreleased'

.PHONY: check-changelog
check-changelog: ## Check this branch adds a news fragment (same gate as CI)
	echo "$(GREEN)==> Checking for a news fragment against $(BASE_BRANCH)$(RESET)"
	uvx towncrier check --compare-with $(BASE_BRANCH) --config towncrier.toml --dir .


# Release
.PHONY: release-dry-run
release-dry-run: ## Dry-run a release of @plone/mcp, publishing nothing
	echo "$(GREEN)==> Dry-running the release of @plone/mcp$(RESET)"
	pnpm dry-release

.PHONY: release-alpha
release-alpha: ## Publish an alpha prerelease of @plone/mcp to npmjs.org
	echo "$(RED)==> Publishing an alpha prerelease of @plone/mcp$(RESET)"
	pnpm release-alpha

.PHONY: release
release: ## Publish @plone/mcp to npmjs.org
	echo "$(RED)==> Publishing @plone/mcp$(RESET)"
	pnpm release
