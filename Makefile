.PHONY: all format test

all: ## Show this help.
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

format: ## Format code using Prettier.
	pnpm run format

test: ## Run all tests.
	pnpm test
