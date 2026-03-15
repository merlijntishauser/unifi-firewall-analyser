import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ColorMode } from "@xyflow/react";
import { AppContext, type AppContextValue } from "../hooks/useAppContext";
import { createTestQueryClient } from "../test-utils";
import FirewallModule from "./FirewallModule";
import type { Zone, ZonePair } from "../api/types";

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children, onEdgeClick, edges }: {
    children: React.ReactNode;
    onEdgeClick?: (event: unknown, edge: { source: string; target: string }) => void;
    edges: Array<{ id: string; source: string; target: string }>;
  }) => (
    <div data-testid="react-flow">
      {children}
      {Array.isArray(edges) && edges.map((edge) => (
        <button key={edge.id} data-testid={`edge-${edge.id}`} onClick={(e) => onEdgeClick?.(e, edge)}>
          {edge.id}
        </button>
      ))}
    </div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  Handle: () => <div />,
  Position: { Top: "top", Bottom: "bottom" },
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  BaseEdge: () => <div />,
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MarkerType: { ArrowClosed: "arrowclosed" },
  getSmoothStepPath: () => ["", 0, 0],
}));

vi.mock("./ZoneMatrix", () => ({
  default: ({ zones, onZoneClick }: {
    zones: Array<{ id: string; name: string }>;
    onZoneClick: (zoneId: string) => void;
  }) => (
    <div data-testid="zone-matrix">
      {zones.map((z) => (
        <button key={z.id} data-testid={`matrix-zone-${z.id}`} onClick={() => onZoneClick(z.id)}>
          {z.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("./utils/layout", () => ({
  getLayoutedElements: (nodes: unknown[], edges: unknown[]) => ({ nodes, edges }),
}));

const testZones: Zone[] = [
  { id: "z1", name: "External", networks: [] },
  { id: "z2", name: "Internal", networks: [] },
];

const testZonePairs: ZonePair[] = [
  {
    source_zone_id: "z1",
    destination_zone_id: "z2",
    rules: [{
      id: "r1", name: "Allow HTTP", description: "", enabled: true,
      action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2",
      protocol: "TCP", port_ranges: ["80"], ip_ranges: [], index: 1, predefined: false,
    }],
    allow_count: 1, block_count: 0,
    analysis: { score: 85, grade: "B", findings: [] },
  },
];

function makeContext(overrides?: Partial<AppContextValue>): AppContextValue {
  return {
    colorMode: "dark" as ColorMode,
    themePreference: "dark",
    onThemePreferenceChange: vi.fn(),
    showHidden: false,
    onShowHiddenChange: vi.fn(),
    hasHiddenZones: false,
    hasDisabledRules: false,
    onRefresh: vi.fn(),
    dataLoading: false,
    onLogout: vi.fn(),
    onOpenSettings: vi.fn(),
    onCloseSettings: vi.fn(),
    settingsOpen: false,
    connectionInfo: null,
    aiInfo: { configured: false, provider: "", model: "" },
    aiConfigured: false,
    zones: testZones,
    zonePairs: testZonePairs,
    filteredZonePairs: testZonePairs,
    visibleZones: testZones,
    hiddenZoneIds: new Set<string>(),
    onToggleZone: vi.fn(),
    dataError: null,
    notificationsOpen: false,
    onOpenNotifications: vi.fn(),
    onCloseNotifications: vi.fn(),
    notificationCount: 0,
    ...overrides,
  };
}

function renderModule(ctx?: Partial<AppContextValue>) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AppContext.Provider value={makeContext(ctx)}>
        <MemoryRouter>
          <FirewallModule />
        </MemoryRouter>
      </AppContext.Provider>
    </QueryClientProvider>,
  );
}

describe("FirewallModule", () => {
  it("shows matrix view by default", () => {
    renderModule();
    expect(screen.getByTestId("zone-matrix")).toBeInTheDocument();
  });

  it("shows loading overlay when data is loading and zones are empty", () => {
    renderModule({ dataLoading: true, zones: [], zonePairs: [] });
    expect(screen.getByText("Connecting to controller...")).toBeInTheDocument();
  });

  it("shows error message when dataError is set", () => {
    renderModule({ dataError: new Error("Connection refused") });
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("renders Refresh button in local toolbar", () => {
    renderModule();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("shows Refreshing state when data is loading", () => {
    renderModule({ dataLoading: true });
    expect(screen.getByRole("button", { name: "Refreshing..." })).toBeDisabled();
  });

  it("calls onRefresh when Refresh is clicked", () => {
    const handler = vi.fn();
    renderModule({ onRefresh: handler });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("shows toggle when hidden zones exist", () => {
    renderModule({ hasHiddenZones: true });
    expect(screen.getByLabelText("Show filtered zones")).toBeInTheDocument();
  });

  it("shows toggle when disabled rules exist", () => {
    renderModule({ hasDisabledRules: true });
    expect(screen.getByLabelText("Show disabled rules")).toBeInTheDocument();
  });

  it("does not show toggle when no hidden zones or disabled rules", () => {
    renderModule();
    expect(screen.queryByLabelText(/Show (filtered zones|disabled rules)/)).not.toBeInTheDocument();
  });

  it("navigates to graph view when zone is clicked", async () => {
    renderModule();
    fireEvent.click(screen.getByTestId("matrix-zone-z1"));
    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("deep-links to zone pair from URL search param", async () => {
    window.history.replaceState({}, "", "?pair=External->Internal");
    renderModule();
    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
    expect(window.location.search).toBe("");
  });

  it("ignores deep-link with invalid zone names", () => {
    window.history.replaceState({}, "", "?pair=Nonexistent->Zone");
    renderModule();
    expect(screen.getByTestId("zone-matrix")).toBeInTheDocument();
  });

  it("ignores deep-link with malformed pair param", () => {
    window.history.replaceState({}, "", "?pair=no-arrow");
    renderModule();
    expect(screen.getByTestId("zone-matrix")).toBeInTheDocument();
  });
});
