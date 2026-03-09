# Zone Matrix Visualization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the unreadable full-mesh node graph with a two-level navigation: matrix overview + filtered graph detail.

**Architecture:** Matrix view as the home screen showing all zone pairs in a CSS grid. Clicking a zone header drills into a React Flow graph filtered to that zone's connections. Clicking a matrix cell or graph edge opens the existing RulePanel.

**Tech Stack:** React, Tailwind CSS (matrix), React Flow + dagre (detail graph), Vitest + Testing Library (tests).

---

### Task 1: Create MatrixCell component

**Files:**
- Create: `frontend/src/components/MatrixCell.tsx`
- Test: `frontend/src/components/MatrixCell.test.tsx`

**Step 1: Write the failing tests**

```tsx
// frontend/src/components/MatrixCell.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MatrixCell from "./MatrixCell";

describe("MatrixCell", () => {
  it("renders green when all rules are ALLOW", () => {
    render(<MatrixCell allowCount={3} blockCount={0} totalRules={3} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-green-100");
  });

  it("renders red when all rules are BLOCK", () => {
    render(<MatrixCell allowCount={0} blockCount={2} totalRules={2} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-red-100");
  });

  it("renders amber when rules are mixed", () => {
    render(<MatrixCell allowCount={1} blockCount={1} totalRules={2} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-amber-100");
  });

  it("renders gray when no rules exist", () => {
    render(<MatrixCell allowCount={0} blockCount={0} totalRules={0} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-gray-50");
  });

  it("shows rule count", () => {
    render(<MatrixCell allowCount={2} blockCount={1} totalRules={3} onClick={vi.fn()} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<MatrixCell allowCount={1} blockCount={0} totalRules={1} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies dimmed style when isSelfPair is true", () => {
    render(<MatrixCell allowCount={0} blockCount={0} totalRules={0} onClick={vi.fn()} isSelfPair />);
    expect(screen.getByRole("button")).toHaveClass("opacity-40");
  });

  it("does not apply dimmed style when isSelfPair is false", () => {
    render(<MatrixCell allowCount={1} blockCount={0} totalRules={1} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).not.toHaveClass("opacity-40");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/MatrixCell.test.tsx`
Expected: FAIL - cannot find module `./MatrixCell`

**Step 3: Write minimal implementation**

```tsx
// frontend/src/components/MatrixCell.tsx
interface MatrixCellProps {
  allowCount: number;
  blockCount: number;
  totalRules: number;
  onClick: () => void;
  isSelfPair?: boolean;
}

function getCellColor(allowCount: number, blockCount: number): string {
  if (allowCount === 0 && blockCount === 0) return "bg-gray-50 dark:bg-gray-800";
  if (allowCount > 0 && blockCount === 0) return "bg-green-100 dark:bg-green-900";
  if (blockCount > 0 && allowCount === 0) return "bg-red-100 dark:bg-red-900";
  return "bg-amber-100 dark:bg-amber-900";
}

export default function MatrixCell({
  allowCount,
  blockCount,
  totalRules,
  onClick,
  isSelfPair = false,
}: MatrixCellProps) {
  const color = getCellColor(allowCount, blockCount);

  return (
    <button
      onClick={onClick}
      className={`w-full h-full flex items-center justify-center text-xs font-medium rounded border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-blue-400 cursor-pointer transition-shadow ${color} ${isSelfPair ? "opacity-40" : ""}`}
    >
      {totalRules > 0 ? (
        <span className="text-gray-700 dark:text-gray-300">{totalRules}</span>
      ) : (
        <span className="text-gray-400 dark:text-gray-600">&mdash;</span>
      )}
    </button>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/MatrixCell.test.tsx`
Expected: PASS (8 tests)

**Step 5: Commit**

```bash
git add frontend/src/components/MatrixCell.tsx frontend/src/components/MatrixCell.test.tsx
git commit -m "feat: add MatrixCell component with color-coded posture"
```

---

### Task 2: Create ZoneMatrix component

**Files:**
- Create: `frontend/src/components/ZoneMatrix.tsx`
- Test: `frontend/src/components/ZoneMatrix.test.tsx`

**Step 1: Write the failing tests**

```tsx
// frontend/src/components/ZoneMatrix.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ZoneMatrix from "./ZoneMatrix";
import type { Zone, ZonePair } from "../api/types";

// Mock MatrixCell to simplify testing
vi.mock("./MatrixCell", () => ({
  default: ({ allowCount, blockCount, totalRules, onClick, isSelfPair }: {
    allowCount: number;
    blockCount: number;
    totalRules: number;
    onClick: () => void;
    isSelfPair?: boolean;
  }) => (
    <button
      data-testid={`cell-${allowCount}-${blockCount}-${totalRules}`}
      data-self-pair={isSelfPair ? "true" : "false"}
      onClick={onClick}
    >
      {totalRules}
    </button>
  ),
}));

const zones: Zone[] = [
  { id: "z1", name: "External", networks: [] },
  { id: "z2", name: "Internal", networks: [] },
];

const zonePairs: ZonePair[] = [
  {
    source_zone_id: "z1",
    destination_zone_id: "z2",
    rules: [
      {
        id: "r1", name: "Allow HTTP", description: "", enabled: true,
        action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2",
        protocol: "TCP", port_ranges: ["80"], ip_ranges: [], index: 1, predefined: false,
      },
    ],
    allow_count: 1,
    block_count: 0,
  },
];

describe("ZoneMatrix", () => {
  const onCellClick = vi.fn();
  const onZoneClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders zone names as row headers", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    // Row headers are buttons (clickable zone names)
    expect(screen.getByRole("button", { name: "External" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Internal" })).toBeInTheDocument();
  });

  it("renders zone names as column headers", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    // Column headers - there will be duplicate zone names (row + column)
    // Column headers have a specific test ID
    expect(screen.getByTestId("col-header-z1")).toHaveTextContent("External");
    expect(screen.getByTestId("col-header-z2")).toHaveTextContent("Internal");
  });

  it("calls onCellClick with the matching ZonePair when a cell is clicked", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    // Click the cell that has rule count 1 (from zonePairs)
    fireEvent.click(screen.getByTestId("cell-1-0-1"));
    expect(onCellClick).toHaveBeenCalledWith(zonePairs[0]);
  });

  it("calls onZoneClick with zone ID when a row header is clicked", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "External" }));
    expect(onZoneClick).toHaveBeenCalledWith("z1");
  });

  it("calls onZoneClick with zone ID when a column header is clicked", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    fireEvent.click(screen.getByTestId("col-header-z1"));
    expect(onZoneClick).toHaveBeenCalledWith("z1");
  });

  it("marks diagonal cells as self-pair", () => {
    const selfPairs: ZonePair[] = [
      {
        source_zone_id: "z1", destination_zone_id: "z1",
        rules: [], allow_count: 0, block_count: 0,
      },
    ];
    render(
      <ZoneMatrix zones={zones} zonePairs={selfPairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    // The self-pair cell should have isSelfPair=true
    const selfCell = screen.getByTestId("cell-0-0-0");
    // Find the one that is a self-pair
    const allCells = screen.getAllByTestId(/^cell-/);
    const selfPairCells = allCells.filter((c) => c.getAttribute("data-self-pair") === "true");
    expect(selfPairCells.length).toBeGreaterThan(0);
  });

  it("renders empty cells for zone pairs without rules", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={[]} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    // All cells should have totalRules=0
    const allCells = screen.getAllByTestId(/^cell-/);
    allCells.forEach((cell) => {
      expect(cell).toHaveTextContent("0");
    });
  });

  it("renders nothing when zones is empty", () => {
    const { container } = render(
      <ZoneMatrix zones={[]} zonePairs={[]} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    // Grid should exist but have no zone headers
    expect(screen.queryByRole("button", { name: "External" })).not.toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/ZoneMatrix.test.tsx`
Expected: FAIL - cannot find module `./ZoneMatrix`

**Step 3: Write implementation**

```tsx
// frontend/src/components/ZoneMatrix.tsx
import type { Zone, ZonePair } from "../api/types";
import MatrixCell from "./MatrixCell";

interface ZoneMatrixProps {
  zones: Zone[];
  zonePairs: ZonePair[];
  onCellClick: (pair: ZonePair) => void;
  onZoneClick: (zoneId: string) => void;
}

function findPair(zonePairs: ZonePair[], srcId: string, dstId: string): ZonePair | undefined {
  return zonePairs.find((p) => p.source_zone_id === srcId && p.destination_zone_id === dstId);
}

export default function ZoneMatrix({ zones, zonePairs, onCellClick, onZoneClick }: ZoneMatrixProps) {
  const size = zones.length;

  return (
    <div className="h-full flex items-center justify-center p-8 overflow-auto bg-gray-50 dark:bg-gray-900">
      <div
        className="grid gap-px"
        style={{
          gridTemplateColumns: `auto repeat(${size}, minmax(48px, 80px))`,
          gridTemplateRows: `auto repeat(${size}, minmax(48px, 80px))`,
        }}
      >
        {/* Top-left empty corner */}
        <div />

        {/* Column headers */}
        {zones.map((zone) => (
          <button
            key={`col-${zone.id}`}
            data-testid={`col-header-${zone.id}`}
            onClick={() => onZoneClick(zone.id)}
            className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate px-1 pb-2 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer text-center"
            style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
          >
            {zone.name}
          </button>
        ))}

        {/* Rows */}
        {zones.map((srcZone) => (
          <>
            {/* Row header */}
            <button
              key={`row-${srcZone.id}`}
              onClick={() => onZoneClick(srcZone.id)}
              className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate pr-3 flex items-center hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
            >
              {srcZone.name}
            </button>

            {/* Cells */}
            {zones.map((dstZone) => {
              const pair = findPair(zonePairs, srcZone.id, dstZone.id);
              const isSelf = srcZone.id === dstZone.id;

              return (
                <MatrixCell
                  key={`${srcZone.id}-${dstZone.id}`}
                  allowCount={pair?.allow_count ?? 0}
                  blockCount={pair?.block_count ?? 0}
                  totalRules={pair?.rules.length ?? 0}
                  onClick={() => {
                    if (pair) {
                      onCellClick(pair);
                    }
                  }}
                  isSelfPair={isSelf}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/ZoneMatrix.test.tsx`
Expected: PASS (8 tests)

**Step 5: Commit**

```bash
git add frontend/src/components/ZoneMatrix.tsx frontend/src/components/ZoneMatrix.test.tsx
git commit -m "feat: add ZoneMatrix grid component with zone headers"
```

---

### Task 3: Add focusZoneId filtering to ZoneGraph

**Files:**
- Modify: `frontend/src/components/ZoneGraph.tsx`
- Modify: `frontend/src/components/ZoneGraph.test.tsx`

**Step 1: Write the failing tests**

Add these tests to `ZoneGraph.test.tsx`:

```tsx
it("filters to only connected zones when focusZoneId is set", () => {
  const threeZones: Zone[] = [
    { id: "z1", name: "External", networks: [] },
    { id: "z2", name: "Internal", networks: [] },
    { id: "z3", name: "Guest", networks: [] },
  ];
  const pairs: ZonePair[] = [
    {
      source_zone_id: "z1", destination_zone_id: "z2",
      rules: [{ id: "r1", name: "R1", description: "", enabled: true, action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 1, predefined: false }],
      allow_count: 1, block_count: 0,
    },
    {
      source_zone_id: "z2", destination_zone_id: "z3",
      rules: [{ id: "r2", name: "R2", description: "", enabled: true, action: "BLOCK", source_zone_id: "z2", destination_zone_id: "z3", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 2, predefined: false }],
      allow_count: 0, block_count: 1,
    },
  ];

  render(
    <ZoneGraph zones={threeZones} zonePairs={pairs} colorMode="light" onEdgeSelect={onEdgeSelect} focusZoneId="z1" />,
  );
  // z1 connects to z2 only, so we should see 2 nodes (z1, z2) and 1 edge
  expect(screen.getByTestId("nodes-count").textContent).toBe("2");
  expect(screen.getByTestId("edges-count").textContent).toBe("1");
});

it("shows all zones when focusZoneId is not set", () => {
  const threeZones: Zone[] = [
    { id: "z1", name: "External", networks: [] },
    { id: "z2", name: "Internal", networks: [] },
    { id: "z3", name: "Guest", networks: [] },
  ];

  render(
    <ZoneGraph zones={threeZones} zonePairs={[]} colorMode="light" onEdgeSelect={onEdgeSelect} />,
  );
  expect(screen.getByTestId("nodes-count").textContent).toBe("3");
});
```

**Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/ZoneGraph.test.tsx`
Expected: FAIL - `focusZoneId` prop not recognized / node count doesn't match

**Step 3: Modify ZoneGraph to accept focusZoneId**

In `frontend/src/components/ZoneGraph.tsx`, update the interface and `buildElements`:

```tsx
interface ZoneGraphProps {
  zones: Zone[];
  zonePairs: ZonePair[];
  colorMode: ColorMode;
  onEdgeSelect: (pair: ZonePair) => void;
  focusZoneId?: string;
}
```

Update `buildElements` to accept `focusZoneId` and filter:

```tsx
function buildElements(
  zones: Zone[],
  zonePairs: ZonePair[],
  onEdgeSelect: (pair: ZonePair) => void,
  focusZoneId?: string,
) {
  let filteredZones = zones;
  let filteredPairs = zonePairs;

  if (focusZoneId) {
    filteredPairs = zonePairs.filter(
      (p) => p.source_zone_id === focusZoneId || p.destination_zone_id === focusZoneId,
    );
    const connectedIds = new Set<string>();
    connectedIds.add(focusZoneId);
    for (const p of filteredPairs) {
      connectedIds.add(p.source_zone_id);
      connectedIds.add(p.destination_zone_id);
    }
    filteredZones = zones.filter((z) => connectedIds.has(z.id));
  }

  const rawNodes: Node<ZoneNodeData>[] = filteredZones.map((zone) => ({
    id: zone.id,
    type: "zone" as const,
    position: { x: 0, y: 0 },
    data: { label: zone.name, networks: zone.networks },
  }));

  const rawEdges: Edge<RuleEdgeData>[] = filteredPairs.map((pair) => ({
    id: `${pair.source_zone_id}->${pair.destination_zone_id}`,
    source: pair.source_zone_id,
    target: pair.destination_zone_id,
    type: "rule" as const,
    data: {
      allowCount: pair.allow_count,
      blockCount: pair.block_count,
      totalRules: pair.rules.length,
      onLabelClick: () => onEdgeSelect(pair),
    },
  }));

  return getLayoutedElements(rawNodes, rawEdges);
}
```

Update the component to pass `focusZoneId`:

```tsx
export default function ZoneGraph({
  zones,
  zonePairs,
  colorMode,
  onEdgeSelect,
  focusZoneId,
}: ZoneGraphProps) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => buildElements(zones, zonePairs, onEdgeSelect, focusZoneId),
    [zones, zonePairs, onEdgeSelect, focusZoneId],
  );
  // ... rest unchanged
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/ZoneGraph.test.tsx`
Expected: PASS (all tests including new filtering tests)

**Step 5: Commit**

```bash
git add frontend/src/components/ZoneGraph.tsx frontend/src/components/ZoneGraph.test.tsx
git commit -m "feat: add focusZoneId filtering to ZoneGraph"
```

---

### Task 4: Update App.tsx for two-level navigation

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Step 1: Write the failing tests**

Add these tests to `App.test.tsx`. First, mock ZoneMatrix:

```tsx
// Add to the mock section at top of App.test.tsx
vi.mock("./components/ZoneMatrix", () => ({
  default: ({ zones, zonePairs, onCellClick, onZoneClick }: {
    zones: Array<{ id: string; name: string }>;
    zonePairs: Array<{ source_zone_id: string; destination_zone_id: string; rules: unknown[] }>;
    onCellClick: (pair: unknown) => void;
    onZoneClick: (zoneId: string) => void;
  }) => (
    <div data-testid="zone-matrix">
      {zones.map((z) => (
        <button key={z.id} data-testid={`matrix-zone-${z.id}`} onClick={() => onZoneClick(z.id)}>
          {z.name}
        </button>
      ))}
      {zonePairs.map((p) => (
        <button
          key={`${p.source_zone_id}-${p.destination_zone_id}`}
          data-testid={`matrix-cell-${p.source_zone_id}-${p.destination_zone_id}`}
          onClick={() => onCellClick(p)}
        >
          {p.rules.length} rules
        </button>
      ))}
    </div>
  ),
}));
```

Then add the tests:

```tsx
it("shows ZoneMatrix by default (no focusZone)", async () => {
  mockGetAuthStatus.mockResolvedValue({ configured: true, source: "env", url: "https://unifi.local" });
  mockGetZones.mockResolvedValue(testZones);
  mockGetZonePairs.mockResolvedValue(testZonePairs);

  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId("zone-matrix")).toBeInTheDocument();
  });
  // ZoneGraph should NOT be visible
  expect(screen.queryByTestId("react-flow")).not.toBeInTheDocument();
});

it("navigates to graph view when zone header is clicked in matrix", async () => {
  mockGetAuthStatus.mockResolvedValue({ configured: true, source: "env", url: "https://unifi.local" });
  mockGetZones.mockResolvedValue(testZones);
  mockGetZonePairs.mockResolvedValue(testZonePairs);

  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId("zone-matrix")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByTestId("matrix-zone-z1"));

  await waitFor(() => {
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });
  // Matrix should be gone
  expect(screen.queryByTestId("zone-matrix")).not.toBeInTheDocument();
  // Back button should be visible
  expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
});

it("returns to matrix view when back button is clicked", async () => {
  mockGetAuthStatus.mockResolvedValue({ configured: true, source: "env", url: "https://unifi.local" });
  mockGetZones.mockResolvedValue(testZones);
  mockGetZonePairs.mockResolvedValue(testZonePairs);

  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId("zone-matrix")).toBeInTheDocument();
  });

  // Navigate to graph
  fireEvent.click(screen.getByTestId("matrix-zone-z1"));

  await waitFor(() => {
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  // Click back
  fireEvent.click(screen.getByRole("button", { name: /back/i }));

  await waitFor(() => {
    expect(screen.getByTestId("zone-matrix")).toBeInTheDocument();
  });
});

it("opens RulePanel when matrix cell is clicked", async () => {
  mockGetAuthStatus.mockResolvedValue({ configured: true, source: "env", url: "https://unifi.local" });
  mockGetZones.mockResolvedValue(testZones);
  mockGetZonePairs.mockResolvedValue(testZonePairs);

  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId("zone-matrix")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByTestId("matrix-cell-z1-z2"));

  await waitFor(() => {
    expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: FAIL - ZoneMatrix not rendered, no `zone-matrix` testid found

**Step 3: Modify App.tsx**

Update `App.tsx` to add `focusZoneId` state and conditional rendering:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColorMode } from "@xyflow/react";
import { api } from "./api/client";
import type { ZonePair } from "./api/types";
import { useFirewallData } from "./hooks/useFirewallData";
import LoginScreen from "./components/LoginScreen";
import Toolbar from "./components/Toolbar";
import ZoneMatrix from "./components/ZoneMatrix";
import ZoneGraph from "./components/ZoneGraph";
import RulePanel from "./components/RulePanel";

function App() {
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [colorMode, setColorMode] = useState<ColorMode>("light");
  const [showDisabled, setShowDisabled] = useState(false);
  const [selectedPair, setSelectedPair] = useState<ZonePair | null>(null);
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);

  // ... auth effect, handleLogout, zoneNameMap, filteredZonePairs unchanged ...

  const handleEdgeSelect = useCallback((pair: ZonePair) => {
    setSelectedPair(pair);
  }, []);

  const handleZoneClick = useCallback((zoneId: string) => {
    setFocusZoneId(zoneId);
    setSelectedPair(null);
  }, []);

  const handleBack = useCallback(() => {
    setFocusZoneId(null);
    setSelectedPair(null);
  }, []);

  // ... authLoading, !authed returns unchanged ...

  return (
    <div className={`h-screen flex flex-col ${colorMode === "dark" ? "dark" : ""}`}>
      <Toolbar ... />
      {error && ( ... )}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          {focusZoneId ? (
            <>
              <button
                onClick={handleBack}
                className="absolute top-3 left-3 z-10 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm cursor-pointer"
              >
                Back to matrix
              </button>
              <ZoneGraph
                zones={zones}
                zonePairs={filteredZonePairs}
                colorMode={colorMode}
                onEdgeSelect={handleEdgeSelect}
                focusZoneId={focusZoneId}
              />
            </>
          ) : (
            <ZoneMatrix
              zones={zones}
              zonePairs={filteredZonePairs}
              onCellClick={handleEdgeSelect}
              onZoneClick={handleZoneClick}
            />
          )}
        </div>
        {selectedPair && (
          <RulePanel ... />
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

**Step 5: Run coverage check**

Run: `cd frontend && npx vitest run --coverage`
Expected: All thresholds met (statements >= 95%, branches >= 95%, functions >= 95%, lines >= 95%)

**Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: add two-level navigation with matrix home and filtered graph detail"
```

---

### Task 5: Full integration verification

**Step 1: Run full frontend test suite with coverage**

Run: `cd frontend && npx vitest run --coverage`
Expected: ALL PASS, all coverage thresholds met

**Step 2: Run ESLint**

Run: `cd frontend && npx eslint .`
Expected: No errors

**Step 3: Run TypeScript type check**

Run: `cd frontend && npx tsc -b`
Expected: No errors

**Step 4: Run backend tests**

Run: `cd backend && uv run pytest`
Expected: ALL PASS, coverage >= 98%

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: fix any lint/type issues from zone matrix integration"
```
