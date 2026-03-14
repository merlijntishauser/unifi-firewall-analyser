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

echo "=== Frontend: build ==="
cd "$ROOT/frontend" && npx vite build

echo "=== Frontend: eslint ==="
cd "$ROOT/frontend" && npx eslint src/ --no-warn-ignored

echo "=== Frontend: tests ==="
cd "$ROOT/frontend" && npx vitest run --coverage

echo "=== Frontend: react-doctor ==="
score=$(cd "$ROOT/frontend" && npx react-doctor . --yes --score 2>/dev/null | tail -1 | tr -dc '0-9')
if [ -z "$score" ] || [ "$score" -lt 100 ]; then
    echo "FAIL: React Doctor score below 100 (got: ${score:-unknown})"
    exit 1
else
    echo "  Score: $score/100"
fi

echo "=== Complexity ==="
"$ROOT/scripts/check-complexity.sh"

echo ""
echo "All CI checks passed."
