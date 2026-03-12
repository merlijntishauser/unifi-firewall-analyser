# Persistent Zone Filter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist zone filter selections in the database, apply them to the graph view, and repurpose the toolbar toggle to contextually show filtered zones and/or disabled rules.

**Architecture:** New SQLite table + service + router for hidden zone IDs. Frontend loads on auth, saves on toggle (debounced). Toolbar toggle becomes contextual based on whether hidden zones or disabled rules exist.

**Tech Stack:** Python/FastAPI/SQLite (backend), React/TypeScript (frontend)

---

## File Structure

- **Create:** `backend/app/services/zone_filter.py` -- get/save hidden zone IDs
- **Create:** `backend/tests/test_zone_filter_service.py` -- service tests
- **Create:** `backend/app/routers/zone_filter.py` -- REST endpoints
- **Create:** `backend/tests/test_zone_filter_router.py` -- router tests
- **Modify:** `backend/app/database.py` -- add `hidden_zones` table to schema
- **Modify:** `backend/app/main.py` -- register zone filter router
- **Modify:** `frontend/src/api/client.ts` -- add `getHiddenZones` / `saveHiddenZones`
- **Modify:** `frontend/src/api/types.ts` -- add `ZoneFilter` interface
- **Modify:** `frontend/src/App.tsx` -- load/save hidden zones, rename `showDisabled` to `showHidden`, apply filter to graph, pass context to toolbar
- **Modify:** `frontend/src/App.test.tsx` -- update tests
- **Modify:** `frontend/src/components/Toolbar.tsx` -- contextual toggle label
- **Modify:** `frontend/src/components/Toolbar.test.tsx` -- update tests
- **Modify:** `frontend/src/components/ZoneGraph.tsx` -- accept `hiddenZoneIds` prop

---

## Task 1: Backend -- zone filter service and schema

**Files:**
- Modify: `backend/app/database.py:12-27`
- Create: `backend/app/services/zone_filter.py`
- Create: `backend/tests/test_zone_filter_service.py`

- [ ] **Step 1: Write failing tests for zone filter service**

```python
# backend/tests/test_zone_filter_service.py
"""Tests for zone filter persistence service."""

from pathlib import Path

from app.database import init_db
from app.services.zone_filter import get_hidden_zone_ids, save_hidden_zone_ids


class TestZoneFilterService:
    def test_empty_by_default(self, tmp_path: Path) -> None:
        db = tmp_path / "test.db"
        init_db(db)
        assert get_hidden_zone_ids(db) == []

    def test_save_and_get(self, tmp_path: Path) -> None:
        db = tmp_path / "test.db"
        init_db(db)
        save_hidden_zone_ids(db, ["z1", "z2"])
        assert sorted(get_hidden_zone_ids(db)) == ["z1", "z2"]

    def test_save_replaces_previous(self, tmp_path: Path) -> None:
        db = tmp_path / "test.db"
        init_db(db)
        save_hidden_zone_ids(db, ["z1", "z2"])
        save_hidden_zone_ids(db, ["z3"])
        assert get_hidden_zone_ids(db) == ["z3"]

    def test_save_empty_clears_all(self, tmp_path: Path) -> None:
        db = tmp_path / "test.db"
        init_db(db)
        save_hidden_zone_ids(db, ["z1"])
        save_hidden_zone_ids(db, [])
        assert get_hidden_zone_ids(db) == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec api uv run pytest tests/test_zone_filter_service.py -v`
Expected: FAIL -- module not found

- [ ] **Step 3: Add `hidden_zones` table to database schema**

In `backend/app/database.py`, add to `_SCHEMA`:

```sql
CREATE TABLE IF NOT EXISTS hidden_zones (
    zone_id TEXT PRIMARY KEY
);
```

- [ ] **Step 4: Implement zone filter service**

```python
# backend/app/services/zone_filter.py
"""Zone filter persistence service."""

from __future__ import annotations

from pathlib import Path

from app.database import get_connection


def get_hidden_zone_ids(db_path: Path) -> list[str]:
    """Return all hidden zone IDs."""
    conn = get_connection(db_path)
    try:
        rows = conn.execute("SELECT zone_id FROM hidden_zones").fetchall()
        return [row[0] for row in rows]
    finally:
        conn.close()


def save_hidden_zone_ids(db_path: Path, zone_ids: list[str]) -> None:
    """Replace hidden zone IDs with the given list."""
    conn = get_connection(db_path)
    try:
        conn.execute("DELETE FROM hidden_zones")
        if zone_ids:
            conn.executemany(
                "INSERT INTO hidden_zones (zone_id) VALUES (?)",
                [(zid,) for zid in zone_ids],
            )
        conn.commit()
    finally:
        conn.close()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `docker compose exec api uv run pytest tests/test_zone_filter_service.py -v`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```
git add backend/app/database.py backend/app/services/zone_filter.py backend/tests/test_zone_filter_service.py
git commit -m "Add zone filter persistence service and schema"
```

---

## Task 2: Backend -- zone filter router

**Files:**
- Create: `backend/app/routers/zone_filter.py`
- Create: `backend/tests/test_zone_filter_router.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing tests for zone filter router**

```python
# backend/tests/test_zone_filter_router.py
"""Tests for zone filter router."""

import pytest
from httpx import AsyncClient

from app.main import app

pytestmark = pytest.mark.anyio


async def test_get_hidden_zones_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/settings/zone-filter")
    assert resp.status_code == 200
    assert resp.json() == {"hidden_zone_ids": []}


async def test_save_and_get_hidden_zones(client: AsyncClient) -> None:
    resp = await client.put(
        "/api/settings/zone-filter",
        json={"hidden_zone_ids": ["z1", "z2"]},
    )
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

    resp = await client.get("/api/settings/zone-filter")
    assert sorted(resp.json()["hidden_zone_ids"]) == ["z1", "z2"]


async def test_save_replaces_previous(client: AsyncClient) -> None:
    await client.put("/api/settings/zone-filter", json={"hidden_zone_ids": ["z1"]})
    await client.put("/api/settings/zone-filter", json={"hidden_zone_ids": ["z2"]})
    resp = await client.get("/api/settings/zone-filter")
    assert resp.json()["hidden_zone_ids"] == ["z2"]
```

Note: Uses the existing `client` fixture from `conftest.py`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec api uv run pytest tests/test_zone_filter_router.py -v`
Expected: FAIL -- 404 (route not registered)

- [ ] **Step 3: Implement zone filter router**

```python
# backend/app/routers/zone_filter.py
"""Zone filter router for persisting hidden zone selections."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.database import DEFAULT_DB_PATH
from app.services.zone_filter import get_hidden_zone_ids, save_hidden_zone_ids

router = APIRouter(prefix="/api/settings", tags=["settings"])


class ZoneFilterInput(BaseModel):
    hidden_zone_ids: list[str]


@router.get("/zone-filter")
async def get_zone_filter() -> dict[str, list[str]]:
    return {"hidden_zone_ids": get_hidden_zone_ids(DEFAULT_DB_PATH)}


@router.put("/zone-filter")
async def save_zone_filter(body: ZoneFilterInput) -> dict[str, str]:
    save_hidden_zone_ids(DEFAULT_DB_PATH, body.hidden_zone_ids)
    return {"status": "ok"}
```

- [ ] **Step 4: Register router in main.py**

Add `from app.routers.zone_filter import router as zone_filter_router` and `app.include_router(zone_filter_router)` alongside the existing router registrations.

- [ ] **Step 5: Run tests to verify they pass**

Run: `docker compose exec api uv run pytest tests/test_zone_filter_router.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Run full backend tests**

Run: `docker compose exec api uv run pytest -v`
Expected: All pass

- [ ] **Step 7: Commit**

```
git add backend/app/routers/zone_filter.py backend/tests/test_zone_filter_router.py backend/app/main.py
git commit -m "Add zone filter REST endpoints"
```

---

## Task 3: Frontend -- API client and types

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/client.test.ts`

- [ ] **Step 1: Add ZoneFilter type**

In `frontend/src/api/types.ts`, add:

```typescript
export interface ZoneFilter {
  hidden_zone_ids: string[];
}
```

- [ ] **Step 2: Add API methods**

In `frontend/src/api/client.ts`, add to the `api` object:

```typescript
getZoneFilter: () => fetchJson<ZoneFilter>("/settings/zone-filter"),
saveZoneFilter: (hiddenZoneIds: string[]) =>
  fetchJson("/settings/zone-filter", {
    method: "PUT",
    body: JSON.stringify({ hidden_zone_ids: hiddenZoneIds }),
  }),
```

- [ ] **Step 3: Add API client tests**

In `frontend/src/api/client.test.ts`, add tests for both new methods following the existing pattern (mock fetch, call method, verify URL/method/body).

- [ ] **Step 4: Run tests**

Run: `docker compose exec frontend npx vitest run src/api/client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add frontend/src/api/types.ts frontend/src/api/client.ts frontend/src/api/client.test.ts
git commit -m "Add zone filter API client methods"
```

---

## Task 4: Frontend -- Toolbar contextual toggle

**Files:**
- Modify: `frontend/src/components/Toolbar.tsx`
- Modify: `frontend/src/components/Toolbar.test.tsx`

- [ ] **Step 1: Update Toolbar props and rendering**

Change `Toolbar.tsx` props:
- Rename `showDisabled` to `showHidden`
- Rename `onShowDisabledChange` to `onShowHiddenChange`
- Add `hasHiddenZones: boolean`
- Add `hasDisabledRules: boolean`

The toggle:
- Visible only when `hasHiddenZones || hasDisabledRules`
- Label depends on which are present:
  - Both: `"Show filtered zones and disabled rules"`
  - Only zones: `"Show filtered zones"`
  - Only rules: `"Show disabled rules"`

```tsx
{(hasHiddenZones || hasDisabledRules) && (
  <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-noc-text-secondary cursor-pointer select-none">
    <input
      type="checkbox"
      checked={showHidden}
      onChange={(e) => onShowHiddenChange(e.target.checked)}
      className="h-4 w-4 rounded border-gray-300 dark:border-noc-border text-ub-blue focus:ring-ub-blue bg-white dark:bg-noc-input accent-ub-blue"
    />
    {hasHiddenZones && hasDisabledRules
      ? "Show filtered zones and disabled rules"
      : hasHiddenZones
        ? "Show filtered zones"
        : "Show disabled rules"}
  </label>
)}
```

- [ ] **Step 2: Update Toolbar tests**

Update `Toolbar.test.tsx`:
- Update `defaultProps` to use `showHidden`, `onShowHiddenChange`, `hasHiddenZones: false`, `hasDisabledRules: false`
- Test: toggle hidden when both zones and rules are hidden
- Test: toggle hidden when only zones are hidden
- Test: toggle hidden when only disabled rules exist
- Test: toggle not rendered when neither exists

- [ ] **Step 3: Run tests**

Run: `docker compose exec frontend npx vitest run src/components/Toolbar.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```
git add frontend/src/components/Toolbar.tsx frontend/src/components/Toolbar.test.tsx
git commit -m "Make toolbar toggle contextual for hidden zones and disabled rules"
```

---

## Task 5: Frontend -- App integration

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/components/ZoneGraph.tsx`

- [ ] **Step 1: Load hidden zones on auth**

In `App.tsx`, add a `refreshZoneFilter` callback (like `refreshAiConfig`):

```typescript
const refreshZoneFilter = useCallback(() => {
  api.getZoneFilter()
    .then((filter) => dispatch({ hiddenZoneIds: new Set(filter.hidden_zone_ids) }))
    .catch(() => {});
}, []);
```

Call it in the auth effect alongside `refreshAiConfig` when `status.configured` is true.

- [ ] **Step 2: Save on toggle with debounce**

Update `handleToggleZone` to persist after updating local state. Use a simple `setTimeout` debounce (300ms) stored in a ref:

```typescript
const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

const handleToggleZone = useCallback((zoneId: string) => {
  dispatch((prev) => {
    const next = new Set(prev.hiddenZoneIds);
    if (next.has(zoneId)) {
      next.delete(zoneId);
    } else {
      next.add(zoneId);
    }
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.saveZoneFilter([...next]).catch(() => {});
    }, 300);
    return { hiddenZoneIds: next };
  });
}, []);
```

- [ ] **Step 3: Rename `showDisabled` to `showHidden`**

In `AppState`, rename `showDisabled` to `showHidden`. Update all references in App.tsx.

- [ ] **Step 4: Compute `hasDisabledRules` and `hasHiddenZones`**

```typescript
const hasDisabledRules = useMemo(
  () => zonePairs.some((p) => p.rules.some((r) => !r.enabled)),
  [zonePairs],
);

const hasHiddenZones = hiddenZoneIds.size > 0;
```

- [ ] **Step 5: Update `filteredZonePairs` and `visibleZones` to use `showHidden`**

```typescript
const filteredZonePairs = useMemo(() => {
  if (showHidden) return zonePairs;
  return zonePairs.map((pair) => ({
    ...pair,
    rules: pair.rules.filter((r) => r.enabled),
  }));
}, [zonePairs, showHidden]);

const visibleZones = useMemo(() => {
  if (showHidden || hiddenZoneIds.size === 0) return zones;
  return zones.filter((z) => !hiddenZoneIds.has(z.id));
}, [zones, hiddenZoneIds, showHidden]);
```

- [ ] **Step 6: Pass `hiddenZoneIds` to ZoneGraph and update Toolbar props**

ZoneGraph now receives `hiddenZoneIds` and `showHidden`:

```tsx
<ZoneGraph
  zones={zones}
  zonePairs={filteredZonePairs}
  colorMode={colorMode}
  onEdgeSelect={handleEdgeSelect}
  focusZoneIds={focusZoneIds}
  hiddenZoneIds={hiddenZoneIds}
  showHidden={showHidden}
/>
```

Toolbar gets renamed props + new context flags:

```tsx
<Toolbar
  ...
  showHidden={showHidden}
  onShowHiddenChange={(val: boolean) => dispatch({ showHidden: val })}
  hasHiddenZones={hasHiddenZones}
  hasDisabledRules={hasDisabledRules}
/>
```

- [ ] **Step 7: Update ZoneGraph to filter hidden zones**

In `ZoneGraph.tsx`, add `hiddenZoneIds` and `showHidden` to `ZoneGraphProps`. In `buildElements`, after the `focusZoneIds` filtering, apply zone filter:

```typescript
if (!showHidden && hiddenZoneIds.size > 0) {
  filteredZones = filteredZones.filter((z) => !hiddenZoneIds.has(z.id));
  filteredPairs = filteredPairs.filter(
    (p) => !hiddenZoneIds.has(p.source_zone_id) && !hiddenZoneIds.has(p.destination_zone_id),
  );
}
```

- [ ] **Step 8: Update App tests**

- Update all references from `showDisabled` / `"Show disabled rules"` to `showHidden` / contextual labels
- Add test: hidden zones loaded from API on auth
- Add test: toggle shows "Show filtered zones" when zones are hidden
- Add test: toggle hidden when no zones hidden and no disabled rules
- Mock `api.getZoneFilter` and `api.saveZoneFilter` in the mock setup

- [ ] **Step 9: Run full test suite**

Run: `docker compose exec frontend npx vitest run --coverage`
Expected: All tests pass, coverage maintained

- [ ] **Step 10: Run type checks**

Run: `docker compose exec frontend npx tsc --noEmit`
Expected: No errors

- [ ] **Step 11: Commit**

```
git add frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/components/ZoneGraph.tsx
git commit -m "Integrate persistent zone filter with contextual toolbar toggle"
```
