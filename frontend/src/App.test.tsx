import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import App from "./App";
import type { Zone, ZonePair } from "./api/types";

// Mock the api client
vi.mock("./api/client", () => ({
  api: {
    getAuthStatus: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
    getZones: vi.fn(),
    getZonePairs: vi.fn(),
    simulate: vi.fn(),
    getAiConfig: vi.fn(),
    saveAiConfig: vi.fn(),
    deleteAiConfig: vi.fn(),
    testAiConnection: vi.fn(),
    getAiPresets: vi.fn(),
    analyzeWithAi: vi.fn(),
    toggleRule: vi.fn(),
    swapRuleOrder: vi.fn(),
    getZoneFilter: vi.fn(),
    saveZoneFilter: vi.fn(),
  },
}));

import { api } from "./api/client";

const mockGetAuthStatus = vi.mocked(api.getAuthStatus);
const mockLogout = vi.mocked(api.logout);
const mockGetZones = vi.mocked(api.getZones);
const mockGetZonePairs = vi.mocked(api.getZonePairs);
const mockLogin = vi.mocked(api.login);
const mockGetAiConfig = vi.mocked(api.getAiConfig);
const mockGetZoneFilter = vi.mocked(api.getZoneFilter);
vi.mocked(api.simulate);

// Mock @xyflow/react for ZoneGraph
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children, colorMode, onEdgeClick, edges }: {
    children: React.ReactNode;
    colorMode: string;
    onEdgeClick?: (event: unknown, edge: { source: string; target: string }) => void;
    edges: Array<{ id: string; source: string; target: string; data?: { onLabelClick?: () => void } }>;
  }) => (
    <div data-testid="react-flow" data-color-mode={colorMode}>
      {children}
      {Array.isArray(edges) && edges.map((edge) => (
        <button
          key={edge.id}
          data-testid={`edge-${edge.id}`}
          onClick={(e) => {
            onEdgeClick?.(e, edge);
          }}
        >
          {edge.id}
        </button>
      ))}
      {Array.isArray(edges) && edges.map((edge) => (
        edge.data?.onLabelClick && (
          <button
            key={`label-${edge.id}`}
            data-testid={`edge-label-${edge.id}`}
            onClick={() => edge.data?.onLabelClick?.()}
          >
            label {edge.id}
          </button>
        )
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

// Mock SettingsModal
vi.mock("./components/SettingsModal", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="settings-modal">
      <button data-testid="close-settings" onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock ZoneMatrix
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

// Mock dagre layout - pass through
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
    rules: [
      {
        id: "r1",
        name: "Allow HTTP",
        description: "",
        enabled: true,
        action: "ALLOW",
        source_zone_id: "z1",
        destination_zone_id: "z2",
        protocol: "TCP",
        port_ranges: ["80"],
        ip_ranges: [],
        index: 1,
        predefined: false,
      },
    ],
    allow_count: 1,
    block_count: 0,
    analysis: { score: 85, grade: "B", findings: [] },
  },
];

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetAiConfig.mockResolvedValue({
      base_url: "",
      model: "",
      provider_type: "",
      has_key: false,
      source: "none",
    });
    mockGetZoneFilter.mockResolvedValue({ hidden_zone_ids: [] });
    vi.mocked(api.saveZoneFilter).mockResolvedValue({ status: "ok" });
  });

  it("shows loading spinner initially", () => {
    mockGetAuthStatus.mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows login screen when not authenticated", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: false,
      source: "none",
      url: "",
    });
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Connect to UniFi Controller")).toBeInTheDocument();
    });
  });

  it("shows login screen when auth status check fails", async () => {
    mockGetAuthStatus.mockRejectedValue(new Error("Network error"));
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Connect to UniFi Controller")).toBeInTheDocument();
    });
  });

  it("shows main UI when authenticated", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("UniFi Firewall Analyser")).toBeInTheDocument();
    });
  });

  it("transitions from login to main UI after successful login", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: false,
      source: "none",
      url: "",
    });
    mockLogin.mockResolvedValue(undefined);
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Connect to UniFi Controller")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Controller URL"), {
      target: { value: "https://192.168.1.1" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    });

    await waitFor(() => {
      expect(screen.getByText("UniFi Firewall Analyser")).toBeInTheDocument();
    });
  });

  it("logs out and shows login screen", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);
    mockLogout.mockResolvedValue(undefined);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("UniFi Firewall Analyser")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Connect to UniFi Controller")).toBeInTheDocument();
    });
  });

  it("shows error when data fetch fails", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetZones.mockRejectedValue(new Error("Fetch failed"));
    mockGetZonePairs.mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Fetch failed")).toBeInTheDocument();
    });
  });

  it("toggles color mode", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(localStorage.getItem("colorMode")).toBe("light");
  });

  it("restores color mode from localStorage", async () => {
    localStorage.setItem("colorMode", "light");
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      // Light mode shows "Dark" button to switch back
      expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    });
  });

  it("shows contextual toggle for disabled rules and toggles it", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue([
      {
        source_zone_id: "z1",
        destination_zone_id: "z2",
        rules: [
          {
            id: "r1",
            name: "Enabled Rule",
            description: "",
            enabled: true,
            action: "ALLOW",
            source_zone_id: "z1",
            destination_zone_id: "z2",
            protocol: "TCP",
            port_ranges: [],
            ip_ranges: [],
            index: 1,
            predefined: false,
          },
          {
            id: "r2",
            name: "Disabled Rule",
            description: "",
            enabled: false,
            action: "BLOCK",
            source_zone_id: "z1",
            destination_zone_id: "z2",
            protocol: "TCP",
            port_ranges: [],
            ip_ranges: [],
            index: 2,
            predefined: false,
          },
        ],
        allow_count: 1,
        block_count: 1,
        analysis: { score: 70, grade: "C", findings: [] },
      },
    ]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText("Show disabled rules")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Show disabled rules")).not.toBeChecked();

    fireEvent.click(screen.getByLabelText("Show disabled rules"));
    expect(screen.getByLabelText("Show disabled rules")).toBeChecked();
  });

  it("does not show toggle when no disabled rules and no hidden zones", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("UniFi Firewall Analyser")).toBeInTheDocument();
    });

    // The toolbar toggle should not show any of these labels
    expect(screen.queryByLabelText("Show disabled rules")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Show filtered zones")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Show filtered zones and disabled rules")).not.toBeInTheDocument();
  });

  it("shows 'Show filtered zones' when zones are hidden", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    render(<App />);

    // Wait for zones to load and render in sidebar
    await waitFor(() => {
      expect(screen.getByLabelText("External")).toBeInTheDocument();
    });

    // Hide a zone via sidebar
    fireEvent.click(screen.getByLabelText("External"));

    expect(screen.getByLabelText("Show filtered zones")).toBeInTheDocument();
  });

  it("loads hidden zones from API on auth", async () => {
    mockGetZoneFilter.mockResolvedValue({ hidden_zone_ids: ["z1"] });
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    render(<App />);

    await waitFor(() => {
      expect(mockGetZoneFilter).toHaveBeenCalled();
    });

    // z1 should be hidden from the matrix
    await waitFor(() => {
      expect(screen.queryByTestId("matrix-zone-z1")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("matrix-zone-z2")).toBeInTheDocument();
  });

  it("calls refresh when Refresh button is clicked", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    });

    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    });

    expect(mockGetZones).toHaveBeenCalledTimes(2);
  });

  it("shows RulePanel when an edge is clicked and closes it", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    render(<App />);

    // First navigate to graph view by clicking a zone in the matrix
    await waitFor(() => {
      expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-zone-z1"));

    // Click the edge to select a zone pair - the mock ReactFlow renders edge buttons
    await waitFor(() => {
      expect(screen.getByTestId("edge-z1->z2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("edge-z1->z2"));

    // RulePanel should now be visible with the zone pair
    await waitFor(() => {
      expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
    });

    // Verify zone names are shown in the panel header
    const header = screen.getByRole("heading", { level: 2 });
    expect(header.textContent).toContain("External");
    expect(header.textContent).toContain("Internal");

    // Close the panel
    fireEvent.click(screen.getByLabelText("Close panel"));

    await waitFor(() => {
      expect(screen.queryByLabelText("Close panel")).not.toBeInTheDocument();
    });
  });

  it("shows RulePanel via edge label click (onLabelClick)", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    render(<App />);

    // First navigate to graph view by clicking a zone in the matrix
    await waitFor(() => {
      expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-zone-z1"));

    // Click the edge label button (exercises onLabelClick / buildElements callback)
    await waitFor(() => {
      expect(screen.getByTestId("edge-label-z1->z2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("edge-label-z1->z2"));

    // RulePanel should be visible
    await waitFor(() => {
      expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
    });
  });

  it("shows 'Unknown' for zone names when zone is not found", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    // Return zones but with IDs that don't match the zone pair
    mockGetZones.mockResolvedValue([
      { id: "z999", name: "Other", networks: [] },
    ]);
    mockGetZonePairs.mockResolvedValue([
      {
        source_zone_id: "z1",
        destination_zone_id: "z2",
        rules: [
          {
            id: "r1",
            name: "Rule",
            description: "",
            enabled: true,
            action: "ALLOW",
            source_zone_id: "z1",
            destination_zone_id: "z2",
            protocol: "TCP",
            port_ranges: [],
            ip_ranges: [],
            index: 1,
            predefined: false,
          },
        ],
        allow_count: 1,
        block_count: 0,
        analysis: { score: 85, grade: "B", findings: [] },
      },
    ]);

    render(<App />);

    // Click the matrix cell to open the RulePanel directly
    await waitFor(() => {
      expect(screen.getByTestId("matrix-cell-z1-z2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-cell-z1-z2"));

    // Panel should show "Unknown" for both zone names since z1/z2 are not in the zones list
    await waitFor(() => {
      const header = screen.getByRole("heading", { level: 2 });
      expect(header.textContent).toContain("Unknown");
    });
  });

  it("shows ZoneMatrix by default (no focusZone)", async () => {
    mockGetAuthStatus.mockResolvedValue({ configured: true, source: "env", url: "https://unifi.local" });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("zone-matrix")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("react-flow")).not.toBeInTheDocument();
  });

  it("navigates to graph view when zone header is clicked in matrix", async () => {
    mockGetAuthStatus.mockResolvedValue({ configured: true, source: "env", url: "https://unifi.local" });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-zone-z1"));

    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("zone-matrix")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("returns to matrix view when back button is clicked", async () => {
    mockGetAuthStatus.mockResolvedValue({ configured: true, source: "env", url: "https://unifi.local" });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-zone-z1"));

    await waitFor(() => {
      expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
    });
  });

  it("opens RulePanel and graph view when matrix cell is clicked", async () => {
    mockGetAuthStatus.mockResolvedValue({ configured: true, source: "env", url: "https://unifi.local" });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("matrix-cell-z1-z2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-cell-z1-z2"));

    await waitFor(() => {
      expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
    expect(screen.queryByTestId("zone-matrix")).not.toBeInTheDocument();
  });

  it("opens and closes settings modal", async () => {
    mockGetAuthStatus.mockResolvedValue({ configured: true, source: "env", url: "https://unifi.local" });
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByTestId("settings-modal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("close-settings"));

    await waitFor(() => {
      expect(screen.queryByTestId("settings-modal")).not.toBeInTheDocument();
    });
  });

  it("refreshes AI config when settings modal closes", async () => {
    mockGetAuthStatus.mockResolvedValue({ configured: true, source: "env", url: "https://unifi.local" });
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    });

    // Clear the initial call count
    mockGetAiConfig.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByTestId("settings-modal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("close-settings"));

    await waitFor(() => {
      expect(mockGetAiConfig).toHaveBeenCalled();
    });
  });

  it("calls getAiConfig when authenticated", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetZones.mockResolvedValue([]);
    mockGetZonePairs.mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("UniFi Firewall Analyser")).toBeInTheDocument();
    });

    expect(mockGetAiConfig).toHaveBeenCalled();
  });

  it("shows Analyze with AI button when AI is configured", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetAiConfig.mockResolvedValue({
      base_url: "",
      model: "",
      provider_type: "",
      has_key: true,
      source: "none",
    });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("matrix-cell-z1-z2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-cell-z1-z2"));

    await waitFor(() => {
      expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Analyze with AI" })).toBeInTheDocument();
  });

  it("renders MatrixSidebar in matrix view", async () => {
    mockGetAuthStatus.mockResolvedValue({ configured: true, source: "env", url: "" });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Zones")).toBeInTheDocument();
    });
    expect(screen.getByText("Security Score")).toBeInTheDocument();
    expect(screen.getByText("Cell Colors")).toBeInTheDocument();
  });

  it("hides zone from matrix when unchecked in sidebar", async () => {
    mockGetAuthStatus.mockResolvedValue({ configured: true, source: "env", url: "" });
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
    });
    expect(screen.getByTestId("matrix-zone-z2")).toBeInTheDocument();

    // Uncheck the first zone
    fireEvent.click(screen.getByLabelText("External"));

    // Zone should be removed from the matrix
    expect(screen.queryByTestId("matrix-zone-z1")).not.toBeInTheDocument();
    // Other zone still visible
    expect(screen.getByTestId("matrix-zone-z2")).toBeInTheDocument();

    // Re-check to bring it back
    fireEvent.click(screen.getByLabelText("External"));
    expect(screen.getByTestId("matrix-zone-z1")).toBeInTheDocument();
  });

  it("does not show Analyze with AI button when AI config fails", async () => {
    mockGetAuthStatus.mockResolvedValue({
      configured: true,
      source: "env",
      url: "https://unifi.local",
    });
    mockGetAiConfig.mockRejectedValue(new Error("AI config fetch failed"));
    mockGetZones.mockResolvedValue(testZones);
    mockGetZonePairs.mockResolvedValue(testZonePairs);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("matrix-cell-z1-z2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("matrix-cell-z1-z2"));

    await waitFor(() => {
      expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Analyze with AI" })).not.toBeInTheDocument();
  });
});
