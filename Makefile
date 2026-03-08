.PHONY: up down build quality complexity test

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
	@echo "Complexity analysis placeholder -- not yet implemented"

test:
	docker compose exec api uv run pytest
	docker compose exec frontend npx vitest run
