.PHONY: up down build build-prod build-prod-alpine smoke-prod smoke-prod-alpine quality complexity test backend-install frontend-install ci help

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

build-prod: ## Build the production single-container image locally
	docker build -t unifi-firewall-analyser:local .

build-prod-alpine: ## Build the experimental Alpine production image locally
	docker build -f Dockerfile.alpine -t unifi-firewall-analyser:alpine-local .

smoke-prod: ## Smoke-test the production single-container image locally
	./scripts/smoke-test-image.sh unifi-firewall-analyser:local unifi-firewall-analyser-smoke 18080

smoke-prod-alpine: ## Smoke-test the experimental Alpine image locally
	./scripts/smoke-test-image.sh unifi-firewall-analyser:alpine-local unifi-firewall-analyser-alpine-smoke 18081

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
