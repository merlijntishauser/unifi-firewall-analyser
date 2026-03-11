# Matrix Sidebar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sidebar to the matrix view with grade legend, cell color legend, and zone visibility toggles.

**Architecture:** New `MatrixSidebar` component rendered left of the matrix. Zone filter state (`hiddenZoneIds`) lives in `App.tsx`'s `AppState` reducer. The matrix receives a filtered `zones` array so the grid naturally shrinks/grows.

**Tech Stack:** React, TypeScript, Tailwind CSS 4

---

## File Structure

- **Create:** `frontend/src/components/MatrixSidebar.tsx` -- sidebar with three sections (grade legend, cell colors, zone filter)
- **Create:** `frontend/src/components/MatrixSidebar.test.tsx` -- tests for sidebar
- **Modify:** `frontend/src/App.tsx` -- add `hiddenZoneIds` to state, derive `visibleZones`, render sidebar
- **Modify:** `frontend/src/App.test.tsx` -- add tests for zone filtering

---

## Chunk 1: MatrixSidebar component and integration

### Task 1: Create MatrixSidebar with tests

**Files:**
- Create: `frontend/src/components/MatrixSidebar.test.tsx`
- Create: `frontend/src/components/MatrixSidebar.tsx`

- [ ] **Step 1: Write failing tests for MatrixSidebar**

```tsx
// frontend/src/components/MatrixSidebar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MatrixSidebar from "./MatrixSidebar";
import type { Zone } from "../api/types";

const testZones: Zone[] = [
  { id: "z1", name: "Internal", networks: [] },
  { id: "z2", name: "External", networks: [] },
  { id: "z3", name: "DMZ", networks: [] },
];

describe("MatrixSidebar", () => {
  it("renders grade legend entries", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
  });

  it("renders grade score ranges", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByText("90 - 100")).toBeInTheDocument();
    expect(screen.getByText("80 - 89")).toBeInTheDocument();
    expect(screen.getByText("65 - 79")).toBeInTheDocument();
    expect(screen.getByText("50 - 64")).toBeInTheDocument();
    expect(screen.getByText("0 - 49")).toBeInTheDocument();
  });

  it("renders cell color legend", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByText("A / B grade")).toBeInTheDocument();
    expect(screen.getByText("C grade")).toBeInTheDocument();
    expect(screen.getByText("D / F grade")).toBeInTheDocument();
    expect(screen.getByText("No rules")).toBeInTheDocument();
  });

  it("renders all zone checkboxes", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Internal")).toBeInTheDocument();
    expect(screen.getByLabelText("External")).toBeInTheDocument();
    expect(screen.getByLabelText("DMZ")).toBeInTheDocument();
  });

  it("shows checkboxes as checked when zone is visible", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    const checkbox = screen.getByLabelText("Internal") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("shows checkbox as unchecked when zone is hidden", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set(["z1"])}
        onToggleZone={vi.fn()}
      />,
    );

    const checkbox = screen.getByLabelText("Internal") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it("calls onToggleZone when checkbox is clicked", () => {
    const onToggleZone = vi.fn();
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={onToggleZone}
      />,
    );

    fireEvent.click(screen.getByLabelText("External"));
    expect(onToggleZone).toHaveBeenCalledWith("z2");
  });

  it("renders section headings", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByText("Grades")).toBeInTheDocument();
    expect(screen.getByText("Cell Colors")).toBeInTheDocument();
    expect(screen.getByText("Zones")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec frontend npx vitest run src/components/MatrixSidebar.test.tsx`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement MatrixSidebar**

```tsx
// frontend/src/components/MatrixSidebar.tsx
import type { Zone } from "../api/types";

interface MatrixSidebarProps {
  zones: Zone[];
  hiddenZoneIds: Set<string>;
  onToggleZone: (zoneId: string) => void;
}

const GRADES = [
  { grade: "A", range: "90 - 100", color: "bg-green-500 dark:bg-status-success" },
  { grade: "B", range: "80 - 89", color: "bg-green-400 dark:bg-status-success/70" },
  { grade: "C", range: "65 - 79", color: "bg-amber-400 dark:bg-status-warning" },
  { grade: "D", range: "50 - 64", color: "bg-red-400 dark:bg-status-danger/70" },
  { grade: "F", range: "0 - 49", color: "bg-red-500 dark:bg-status-danger" },
];

const CELL_COLORS = [
  { label: "A / B grade", bg: "bg-green-100 dark:bg-status-success/15 border-green-300 dark:border-status-success/30" },
  { label: "C grade", bg: "bg-amber-100 dark:bg-status-warning/15 border-amber-300 dark:border-status-warning/30" },
  { label: "D / F grade", bg: "bg-red-100 dark:bg-status-danger/15 border-red-300 dark:border-status-danger/30" },
  { label: "No rules", bg: "bg-gray-100 dark:bg-noc-raised/50 border-gray-300 dark:border-noc-border" },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-display font-semibold uppercase tracking-wider text-gray-400 dark:text-noc-text-dim mb-2">
      {children}
    </h3>
  );
}

export default function MatrixSidebar({ zones, hiddenZoneIds, onToggleZone }: MatrixSidebarProps) {
  return (
    <div className="w-[220px] shrink-0 border-r border-gray-200 dark:border-noc-border bg-white dark:bg-noc-surface px-4 py-5 overflow-y-auto flex flex-col gap-5">
      {/* Grade legend */}
      <section>
        <SectionHeading>Grades</SectionHeading>
        <div className="flex flex-col gap-1.5">
          {GRADES.map(({ grade, range, color }) => (
            <div key={grade} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-sm shrink-0 ${color}`} />
              <span className="text-xs font-semibold text-gray-700 dark:text-noc-text w-4">{grade}</span>
              <span className="text-[11px] text-gray-400 dark:text-noc-text-dim">{range}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Cell color legend */}
      <section>
        <SectionHeading>Cell Colors</SectionHeading>
        <div className="flex flex-col gap-1.5">
          {CELL_COLORS.map(({ label, bg }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded border shrink-0 ${bg}`} />
              <span className="text-[11px] text-gray-500 dark:text-noc-text-secondary">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Zone filter */}
      <section>
        <SectionHeading>Zones</SectionHeading>
        <div className="flex flex-col gap-1">
          {zones.map((zone) => (
            <label
              key={zone.id}
              className="flex items-center gap-2 py-0.5 cursor-pointer select-none group"
            >
              <input
                type="checkbox"
                checked={!hiddenZoneIds.has(zone.id)}
                onChange={() => onToggleZone(zone.id)}
                className="h-3.5 w-3.5 rounded border-gray-300 dark:border-noc-border text-ub-blue focus:ring-ub-blue bg-white dark:bg-noc-input accent-ub-blue"
              />
              <span className="text-xs text-gray-600 dark:text-noc-text-secondary group-hover:text-gray-900 dark:group-hover:text-noc-text transition-colors">
                {zone.name}
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose exec frontend npx vitest run src/components/MatrixSidebar.test.tsx`
Expected: PASS (all 8 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MatrixSidebar.tsx frontend/src/components/MatrixSidebar.test.tsx
git commit -m "Add MatrixSidebar component with grade legend, cell colors, and zone filter"
```

### Task 2: Integrate MatrixSidebar into App

**Files:**
- Modify: `frontend/src/App.tsx:13-47` (state), `frontend/src/App.tsx:153-178` (render)
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write failing tests for zone filtering in App**

Add these tests to `frontend/src/App.test.tsx`:

```tsx
// Import MatrixSidebar-related helpers at the top alongside existing imports

it("renders MatrixSidebar in matrix view", async () => {
  mockGetAuthStatus.mockResolvedValue({ configured: true, source: "runtime", url: "" });
  mockGetZones.mockResolvedValue(testZones);
  mockGetZonePairs.mockResolvedValue([]);
  mockGetAiConfig.mockResolvedValue({ base_url: "", model: "", provider_type: "", has_key: false, source: "none" });

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText("Zones")).toBeInTheDocument();
  });
});

it("hides zone row and column when zone is unchecked in sidebar", async () => {
  mockGetAuthStatus.mockResolvedValue({ configured: true, source: "runtime", url: "" });
  mockGetZones.mockResolvedValue(testZones);
  mockGetZonePairs.mockResolvedValue([]);
  mockGetAiConfig.mockResolvedValue({ base_url: "", model: "", provider_type: "", has_key: false, source: "none" });

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText("Zones")).toBeInTheDocument();
  });

  // Zone should be visible as row and column header
  expect(screen.getByTestId(`row-header-${testZones[0].id}`)).toBeInTheDocument();
  expect(screen.getByTestId(`col-header-${testZones[0].id}`)).toBeInTheDocument();

  // Uncheck the zone
  fireEvent.click(screen.getByLabelText(testZones[0].name));

  // Zone row and column headers should be gone
  expect(screen.queryByTestId(`row-header-${testZones[0].id}`)).not.toBeInTheDocument();
  expect(screen.queryByTestId(`col-header-${testZones[0].id}`)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec frontend npx vitest run src/App.test.tsx`
Expected: FAIL -- "Zones" text not found / sidebar not rendered

- [ ] **Step 3: Integrate MatrixSidebar into App.tsx**

In `App.tsx`:

1. Add import: `import MatrixSidebar from "./components/MatrixSidebar";`

2. Add `hiddenZoneIds` to `AppState`:
```tsx
interface AppState {
  // ... existing fields ...
  hiddenZoneIds: Set<string>;
}
```

3. Update `initialAppState`:
```tsx
const initialAppState: AppState = {
  // ... existing fields ...
  hiddenZoneIds: new Set<string>(),
};
```

4. Destructure in component: add `hiddenZoneIds` to the destructured state.

5. Add `visibleZones` memo after `filteredZonePairs`:
```tsx
const visibleZones = useMemo(() => {
  if (hiddenZoneIds.size === 0) return zones;
  return zones.filter((z) => !hiddenZoneIds.has(z.id));
}, [zones, hiddenZoneIds]);
```

6. Add `handleToggleZone` callback:
```tsx
const handleToggleZone = useCallback((zoneId: string) => {
  dispatch((prev) => {
    const next = new Set(prev.hiddenZoneIds);
    if (next.has(zoneId)) {
      next.delete(zoneId);
    } else {
      next.add(zoneId);
    }
    return { hiddenZoneIds: next };
  });
}, []);
```

**Note:** The existing `appReducer` uses `Partial<AppState>` merge. Since `dispatch` only accepts `Partial<AppState>`, we need `handleToggleZone` to read current state. Change it to use a functional pattern:

```tsx
// Change appReducer to accept either a partial object or a function
type AppAction = Partial<AppState> | ((prev: AppState) => Partial<AppState>);

function appReducer(state: AppState, action: AppAction): AppState {
  const update = typeof action === "function" ? action(state) : action;
  return { ...state, ...update };
}
```

Then `handleToggleZone`:
```tsx
const handleToggleZone = useCallback((zoneId: string) => {
  dispatch((prev) => {
    const next = new Set(prev.hiddenZoneIds);
    if (next.has(zoneId)) {
      next.delete(zoneId);
    } else {
      next.add(zoneId);
    }
    return { hiddenZoneIds: next };
  });
}, []);
```

7. Update the matrix view render (lines 153-178). Change the inner div wrapping the matrix/graph:
```tsx
<div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-noc-bg">
  {focusZoneIds ? (
    <div className="flex-1 relative">
      <button
        onClick={() => history.back()}
        className="absolute top-3 left-3 z-10 rounded-lg bg-white dark:bg-noc-surface border border-gray-300 dark:border-noc-border px-3 py-1.5 text-sm text-gray-700 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised hover:dark:text-noc-text shadow-sm dark:shadow-lg cursor-pointer transition-all"
      >
        Back to matrix
      </button>
      <ZoneGraph
        zones={zones}
        zonePairs={filteredZonePairs}
        colorMode={colorMode}
        onEdgeSelect={handleEdgeSelect}
        focusZoneIds={focusZoneIds}
      />
    </div>
  ) : (
    <>
      <MatrixSidebar
        zones={zones}
        hiddenZoneIds={hiddenZoneIds}
        onToggleZone={handleToggleZone}
      />
      <ZoneMatrix
        zones={visibleZones}
        zonePairs={filteredZonePairs}
        onCellClick={handleCellClick}
        onZoneClick={handleZoneClick}
      />
    </>
  )}
  {selectedPair && (
    <RulePanel ... />
  )}
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose exec frontend npx vitest run src/App.test.tsx`
Expected: PASS (all tests including new ones)

- [ ] **Step 5: Run full test suite and type checks**

Run: `docker compose exec frontend npx vitest run && docker compose exec frontend npx tsc --noEmit`
Expected: All 260+ tests pass, no type errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "Integrate MatrixSidebar into matrix view with zone filtering"
```
