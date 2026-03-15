#!/usr/bin/env bash
#
# Release script: validates changelog, bumps version in source files,
# commits, tags, and pushes to GitHub.
#
# Usage: ./scripts/release.sh <version>
#   e.g. ./scripts/release.sh 1.0.0
#
# The version should NOT include the "v" prefix (it's added automatically).

set -euo pipefail

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "  e.g. $0 1.0.0"
  exit 1
fi

TAG="v${VERSION}"

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------

# Must be on main branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "Error: must be on the main branch (currently on '$BRANCH')"
  exit 1
fi

# Working tree must be clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree is not clean -- commit or stash changes first"
  exit 1
fi

# Tag must not already exist
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: tag '$TAG' already exists"
  exit 1
fi

# Version must follow semver pattern
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: version '$VERSION' is not valid semver (expected X.Y.Z)"
  exit 1
fi

# Changelog must mention this version
if ! grep -q "## \[${VERSION}\]" CHANGELOG.md; then
  echo "Error: CHANGELOG.md does not contain a section for [${VERSION}]"
  echo "  Add a '## [${VERSION}] - YYYY-MM-DD' section before releasing."
  exit 1
fi

# Changelog must have a date for this version (not just the header)
if ! grep -qE "## \[${VERSION}\] - [0-9]{4}-[0-9]{2}-[0-9]{2}" CHANGELOG.md; then
  echo "Error: CHANGELOG.md section for [${VERSION}] is missing a date"
  echo "  Expected format: '## [${VERSION}] - YYYY-MM-DD'"
  exit 1
fi

# ---------------------------------------------------------------------------
# Bump version in source files
# ---------------------------------------------------------------------------

echo "Bumping version to ${VERSION}..."

# backend/pyproject.toml
sed -i.bak "s/^version = \".*\"/version = \"${VERSION}\"/" backend/pyproject.toml
rm -f backend/pyproject.toml.bak

# frontend/package.json (only the top-level version field)
sed -i.bak "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" frontend/package.json
rm -f frontend/package.json.bak

echo "  backend/pyproject.toml -> ${VERSION}"
echo "  frontend/package.json  -> ${VERSION}"

# Regenerate lockfiles so they stay in sync
echo "Syncing lockfiles..."
(cd backend && uv lock --quiet)
(cd frontend && npm install --package-lock-only --silent)

# ---------------------------------------------------------------------------
# Commit, tag, push
# ---------------------------------------------------------------------------

git add backend/pyproject.toml backend/uv.lock frontend/package.json frontend/package-lock.json
git commit -m "Bump version to ${VERSION}"

echo "Creating signed tag ${TAG}..."
git tag -s "$TAG" -m "Release ${VERSION}"

echo "Pushing to origin..."
git push origin main "$TAG"

echo ""
echo "Released ${TAG}"
echo "  GitHub: https://github.com/merlijntishauser/unifi-homelab-ops/releases/tag/${TAG}"
echo "  Docker: docker pull merlijntishauser/unifi-homelab-ops:${VERSION}"
