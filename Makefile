.PHONY: up down build quality complexity test backend-install frontend-install

backend-install:
	cd backend && uv sync

frontend-install:
	cd frontend && npm install

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

quality:
	docker compose exec api uv run ruff check app/
	docker compose exec api uv run mypy app/
	docker compose exec frontend npx tsc --noEmit

complexity:
	@./scripts/check-complexity.sh

test:
	docker compose exec api uv run pytest
	docker compose exec frontend npx vitest run --coverage
