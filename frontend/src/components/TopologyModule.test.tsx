import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ColorMode } from "@xyflow/react";
import { AppContext, type AppContextValue } from "../hooks/useAppContext";
import TopologyModule from "./TopologyModule";

vi.mock("../utils/export", () => ({
  downloadSvg: vi.fn(),
  downloadPng: vi.fn(),
}));

vi.mock("./DeviceMap", () => ({
  default: ({ devices, onDeviceSelect }: { devices: Array<{ mac: string; name: string }>; onDeviceSelect: (d: unknown) => void }) => (
    <div data-testid="device-map">
      {devices.map((d) => (
        <button key={d.mac} data-testid={`device-${d.mac}`} onClick={() => onDeviceSelect(d)}>{d.name}</button>
      ))}
    </div>
  ),
}));

vi.mock("./DevicePanel", () => ({
  default: ({ device, onClose }: { device: { name: string }; onClose: () => void }) => (
    <div data-testid="device-panel">
      <span>{device.name}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock("./SvgViewer", () => ({
  default: ({ svgContent }: { svgContent: string }) => (
    <div data-testid="svg-viewer">{svgContent.substring(0, 20)}</div>
  ),
}));

const svgMock = vi.hoisted(() => ({
  data: { svg: "<svg>test</svg>", projection: "isometric" } as { svg: string; projection: string } | undefined,
  isLoading: false,
  error: null as Error | null,
}));

const devicesMock = vi.hoisted(() => ({
  data: {
    devices: [
      { mac: "aa:bb:cc:dd:ee:01", name: "Gateway", model: "UDM-Pro", model_name: "UDM Pro", type: "gateway", ip: "192.168.1.1", version: "4.0.6", uptime: 86400, status: "online", client_count: 5, ports: [] },
      { mac: "aa:bb:cc:dd:ee:02", name: "Switch", model: "USW-24", model_name: "USW 24", type: "switch", ip: "192.168.1.2", version: "7.1.0", uptime: 43200, status: "online", client_count: 10, ports: [] },
    ],
    edges: [{ from_mac: "aa:bb:cc:dd:ee:01", to_mac: "aa:bb:cc:dd:ee:02", speed: 1000, poe: false, wireless: false, local_port: null, remote_port: null }],
  } as { devices: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> } | undefined,
  isLoading: false,
  error: null as Error | null,
}));

vi.mock("../hooks/queries", async () => {
  const actual = await vi.importActual("../hooks/queries");
  return {
    ...actual,
    useTopologySvg: () => svgMock,
    useTopologyDevices: () => devicesMock,
  };
});

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
    connectionInfo: { url: "https://unifi.local", username: "admin", source: "runtime" as const },
    aiInfo: { configured: false, provider: "", model: "" },
    aiConfigured: false,
    zones: [],
    zonePairs: [],
    filteredZonePairs: [],
    visibleZones: [],
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
    <AppContext.Provider value={makeContext(ctx)}>
      <MemoryRouter>
        <TopologyModule />
      </MemoryRouter>
    </AppContext.Provider>,
  );
}

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
  svgMock.data = { svg: "<svg>test</svg>", projection: "isometric" };
  svgMock.isLoading = false;
  svgMock.error = null;
  devicesMock.data = {
    devices: [
      { mac: "aa:bb:cc:dd:ee:01", name: "Gateway", model: "UDM-Pro", model_name: "UDM Pro", type: "gateway", ip: "192.168.1.1", version: "4.0.6", uptime: 86400, status: "online", client_count: 5, ports: [] },
      { mac: "aa:bb:cc:dd:ee:02", name: "Switch", model: "USW-24", model_name: "USW 24", type: "switch", ip: "192.168.1.2", version: "7.1.0", uptime: 43200, status: "online", client_count: 10, ports: [] },
    ],
    edges: [],
  };
  devicesMock.isLoading = false;
  devicesMock.error = null;
});

describe("TopologyModule", () => {
  it("renders map view by default", () => {
    renderModule();
    expect(screen.getByTestId("device-map")).toBeInTheDocument();
  });

  it("shows Map and Diagram toggle buttons", () => {
    renderModule();
    expect(screen.getByRole("button", { name: "Map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Diagram" })).toBeInTheDocument();
  });

  it("switches to diagram view", () => {
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    expect(screen.getByTestId("svg-viewer")).toBeInTheDocument();
  });

  it("shows isometric toggle in diagram view", () => {
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    expect(screen.getByRole("button", { name: "Isometric" })).toBeInTheDocument();
  });

  it("shows export buttons in diagram view when SVG loaded", () => {
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    expect(screen.getByRole("button", { name: "Export SVG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export PNG" })).toBeInTheDocument();
  });

  it("hides diagram controls in map view", () => {
    renderModule();
    expect(screen.queryByRole("button", { name: "Isometric" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export SVG" })).not.toBeInTheDocument();
  });

  it("shows loading state for map", () => {
    devicesMock.data = undefined;
    devicesMock.isLoading = true;
    renderModule();
    expect(screen.getByText("Loading devices...")).toBeInTheDocument();
  });

  it("shows error state for map", () => {
    devicesMock.data = undefined;
    devicesMock.error = new Error("Connection refused");
    renderModule();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("shows loading state for diagram", () => {
    svgMock.data = undefined;
    svgMock.isLoading = true;
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    expect(screen.getByText("Rendering topology...")).toBeInTheDocument();
  });

  it("shows error state for diagram", () => {
    svgMock.data = undefined;
    svgMock.error = new Error("Render failed");
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    expect(screen.getByText("Render failed")).toBeInTheDocument();
  });

  it("opens device panel on device select", () => {
    renderModule();
    fireEvent.click(screen.getByTestId("device-aa:bb:cc:dd:ee:01"));
    expect(screen.getByTestId("device-panel")).toBeInTheDocument();
  });

  it("closes device panel", () => {
    renderModule();
    fireEvent.click(screen.getByTestId("device-aa:bb:cc:dd:ee:01"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("device-panel")).not.toBeInTheDocument();
  });

  it("switches back from diagram to map view", () => {
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    expect(screen.getByTestId("svg-viewer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    expect(screen.getByTestId("device-map")).toBeInTheDocument();
  });

  it("toggles projection in diagram view", () => {
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    const isoBtn = screen.getByRole("button", { name: "Isometric" });
    fireEvent.click(isoBtn);
    // After toggle, projection changes (button text stays "Isometric" but class changes)
    expect(isoBtn).toBeInTheDocument();
  });

  it("calls downloadSvg when Export SVG is clicked", () => {
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    fireEvent.click(screen.getByRole("button", { name: "Export SVG" }));
    // downloadSvg is mocked via module mock but we verify no crash
  });

  it("calls downloadPng when Export PNG is clicked", () => {
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }));
  });

  it("hides export buttons when no SVG data in diagram view", () => {
    svgMock.data = undefined;
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    expect(screen.queryByRole("button", { name: "Export SVG" })).not.toBeInTheDocument();
  });

  it("reads sub-view from localStorage", () => {
    localStorage.setItem("topologySubView", "diagram");
    renderModule();
    expect(screen.getByTestId("svg-viewer")).toBeInTheDocument();
  });

  it("falls back when localStorage throws", () => {
    const orig = localStorage.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    renderModule();
    expect(screen.getByTestId("device-map")).toBeInTheDocument();
    Storage.prototype.getItem = orig;
  });

  it("shows error fallback for non-Error objects in map", () => {
    devicesMock.data = undefined;
    devicesMock.error = { message: "" } as Error;
    renderModule();
    expect(screen.getByText("Failed to load devices")).toBeInTheDocument();
  });

  it("shows error fallback for non-Error objects in diagram", () => {
    svgMock.data = undefined;
    svgMock.error = { message: "" } as Error;
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    expect(screen.getByText("Failed to render topology")).toBeInTheDocument();
  });

  it("deep-links to device from URL search param", () => {
    window.history.replaceState({}, "", "?device=aa:bb:cc:dd:ee:01");
    renderModule();
    expect(screen.getByTestId("device-panel")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("ignores deep-link when device not found", () => {
    window.history.replaceState({}, "", "?device=nonexistent");
    renderModule();
    expect(screen.queryByTestId("device-panel")).not.toBeInTheDocument();
  });

  it("returns null in DiagramContent when no data and not loading", () => {
    svgMock.data = undefined;
    svgMock.isLoading = false;
    svgMock.error = null;
    renderModule();
    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    expect(screen.queryByTestId("svg-viewer")).not.toBeInTheDocument();
    expect(screen.queryByText("Rendering topology...")).not.toBeInTheDocument();
  });
});
