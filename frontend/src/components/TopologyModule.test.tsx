import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ColorMode } from "@xyflow/react";
import { AppContext, type AppContextValue } from "../hooks/useAppContext";
import TopologyModule from "./TopologyModule";
import type { Zone, ZonePair } from "../api/types";

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ edges }: { edges: Array<{ id: string }> }) => (
    <div data-testid="react-flow">
      {Array.isArray(edges) && edges.map((e) => <div key={e.id} data-testid={`edge-${e.id}`} />)}
    </div>
  ),
  Background: () => <div />,
  Controls: () => <div />,
  MiniMap: () => <div />,
  Handle: () => <div />,
  Position: { Top: "top", Bottom: "bottom" },
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  BaseEdge: () => <div />,
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MarkerType: { ArrowClosed: "arrowclosed" },
  getSmoothStepPath: () => ["", 0, 0],
}));

vi.mock("./SvgViewer", () => ({
  default: ({ svgContent }: { svgContent: string }) => (
    <div data-testid="svg-viewer">{svgContent.substring(0, 20)}</div>
  ),
}));

vi.mock("./RulePanel", () => ({
  default: ({ pair }: { pair: { source_zone_id: string; destination_zone_id: string } }) => (
    <div data-testid="rule-panel">{pair.source_zone_id} to {pair.destination_zone_id}</div>
  ),
}));

const svgMock = vi.hoisted(() => ({
  data: { svg: "<svg>test</svg>", theme: "unifi", projection: "orthogonal" } as { svg: string; theme: string; projection: string } | undefined,
  isLoading: false,
  error: null as Error | null,
}));

vi.mock("../hooks/queries", async () => {
  const actual = await vi.importActual("../hooks/queries");
  return {
    ...actual,
    useTopologySvg: () => svgMock,
    useTopologyThemes: () => ({
      data: [
        { id: "unifi", name: "UniFi" }, { id: "unifi-dark", name: "UniFi Dark" },
        { id: "minimal", name: "Minimal" }, { id: "minimal-dark", name: "Minimal Dark" },
        { id: "classic", name: "Classic" }, { id: "classic-dark", name: "Classic Dark" },
      ],
    }),
  };
});

const testZones: Zone[] = [
  { id: "z1", name: "External", networks: [] },
  { id: "z2", name: "Internal", networks: [] },
];

const testZonePairs: ZonePair[] = [
  {
    source_zone_id: "z1", destination_zone_id: "z2",
    rules: [{ id: "r1", name: "Allow", description: "", enabled: true, action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 1, predefined: false }],
    allow_count: 1, block_count: 0, analysis: null,
  },
];

function makeContext(overrides?: Partial<AppContextValue>): AppContextValue {
  return {
    colorMode: "dark" as ColorMode,
    onColorModeChange: vi.fn(),
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
    connectionInfo: { url: "https://unifi.local", username: "admin", source: "runtime" as const },
    aiInfo: { configured: false, provider: "", model: "" },
    aiConfigured: false,
    zones: testZones,
    zonePairs: testZonePairs,
    filteredZonePairs: testZonePairs,
    visibleZones: testZones,
    hiddenZoneIds: new Set<string>(),
    onToggleZone: vi.fn(),
    dataError: null,
    ...overrides,
  };
}

function renderModule(ctx?: Partial<AppContextValue>) {
  return render(
    <AppContext.Provider value={makeContext(ctx)}>
      <MemoryRouter>
        <TopologyModule />
      </MemoryRouter>
    </AppContext.Provider>,
  );
}

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
  svgMock.data = { svg: "<svg>test</svg>", theme: "unifi", projection: "orthogonal" };
  svgMock.isLoading = false;
  svgMock.error = null;
});

describe("TopologyModule", () => {
  it("renders diagram view by default", () => {
    renderModule();
    expect(screen.getByTestId("svg-viewer")).toBeInTheDocument();
  });

  it("shows Diagram and Interactive toggle buttons", () => {
    renderModule();
    expect(screen.getByRole("button", { name: "Diagram" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Interactive" })).toBeInTheDocument();
  });

  it("switches to interactive view", () => {
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Interactive" }));
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("shows theme selector in diagram view", () => {
    renderModule();
    expect(screen.getByLabelText("Theme")).toBeInTheDocument();
  });

  it("shows projection toggle in diagram view", () => {
    renderModule();
    expect(screen.getByRole("button", { name: "Isometric" })).toBeInTheDocument();
  });

  it("shows export buttons when SVG is loaded", () => {
    renderModule();
    expect(screen.getByRole("button", { name: "Export SVG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export PNG" })).toBeInTheDocument();
  });

  it("shows refresh button in interactive view", () => {
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Interactive" }));
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("hides diagram controls in interactive view", () => {
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Interactive" }));
    expect(screen.queryByLabelText("Theme")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export SVG" })).not.toBeInTheDocument();
  });

  it("shows loading state when SVG is loading", () => {
    svgMock.data = undefined; svgMock.isLoading = true; svgMock.error = null;
    renderModule();
    expect(screen.getByText("Rendering topology...")).toBeInTheDocument();
  });

  it("shows error state when SVG fetch fails", () => {
    svgMock.data = undefined; svgMock.isLoading = false; svgMock.error = new Error("Network error");
    renderModule();
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("hides export buttons when no SVG data", () => {
    svgMock.data = undefined; svgMock.isLoading = false; svgMock.error = null;
    renderModule();
    expect(screen.queryByRole("button", { name: "Export SVG" })).not.toBeInTheDocument();
  });

  it("auto-switches to dark theme variant in dark mode", () => {
    renderModule({ colorMode: "dark" as ColorMode });
    const select = screen.getByLabelText("Theme") as HTMLSelectElement;
    expect(select.value).toBe("unifi-dark");
  });

  it("uses light theme variant in light mode", () => {
    renderModule({ colorMode: "light" as ColorMode });
    const select = screen.getByLabelText("Theme") as HTMLSelectElement;
    expect(select.value).toBe("unifi");
  });

  it("toggles projection between orthogonal and isometric", () => {
    renderModule();
    const btn = screen.getByRole("button", { name: "Isometric" });
    fireEvent.click(btn);
    expect(btn.className).toContain("border-ub-blue");
  });

  it("changes theme via selector", () => {
    renderModule({ colorMode: "light" as ColorMode });
    const select = screen.getByLabelText("Theme") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "minimal" } });
    expect(select.value).toBe("minimal");
  });

  it("changes theme to dark variant via selector", () => {
    renderModule({ colorMode: "light" as ColorMode });
    const select = screen.getByLabelText("Theme") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "minimal-dark" } });
    // Should store base theme "minimal" (auto-switch handles dark variant)
    expect(select.value).toBe("minimal");
  });

  it("shows not connected when connectionInfo is null", () => {
    renderModule({ connectionInfo: null });
    // Diagram is shown but query is disabled (enabled=false)
    expect(screen.getByRole("button", { name: "Diagram" })).toBeInTheDocument();
  });

  it("calls onRefresh in interactive view", () => {
    const onRefresh = vi.fn();
    renderModule({ onRefresh });
    fireEvent.click(screen.getByRole("button", { name: "Interactive" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("shows Refreshing state in interactive view when loading", () => {
    renderModule({ dataLoading: true });
    fireEvent.click(screen.getByRole("button", { name: "Interactive" }));
    expect(screen.getByRole("button", { name: "Refreshing..." })).toBeDisabled();
  });
});
