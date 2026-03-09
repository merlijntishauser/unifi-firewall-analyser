.PHONY: up down build quality complexity test backend-install frontend-install ci help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

backend-install: ## Install backend dependencies
	cd backend && uv sync

frontend-install: ## Install frontend dependencies
	cd frontend && npm install

up: ## Start containers
	docker compose up -d

down: ## Stop containers
	docker compose down

build: ## Build containers
	docker compose build

quality: ## Run linters via Docker (ruff, mypy, tsc)
	docker compose exec api uv run ruff check app/
	docker compose exec api uv run mypy app/
	docker compose exec frontend npx tsc --noEmit

complexity: ## Check code complexity
	@./scripts/check-complexity.sh

test: ## Run tests via Docker
	docker compose exec api uv run pytest
	docker compose exec frontend npx vitest run --coverage

ci: ## Run all CI checks locally
	@./scripts/ci-checks.sh
