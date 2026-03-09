#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Backend: ruff ==="
cd "$ROOT/backend" && uv run ruff check app/

echo "=== Backend: mypy ==="
cd "$ROOT/backend" && uv run mypy app/

echo "=== Backend: tests ==="
cd "$ROOT/backend" && uv run pytest -q

echo "=== Frontend: tsc ==="
cd "$ROOT/frontend" && npx tsc --noEmit

echo "=== Frontend: eslint ==="
cd "$ROOT/frontend" && npx eslint src/ --no-warn-ignored

echo "=== Frontend: tests ==="
cd "$ROOT/frontend" && npx vitest run --coverage

echo "=== Complexity ==="
"$ROOT/scripts/check-complexity.sh"

echo ""
echo "All CI checks passed."
