import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ColorMode } from "@xyflow/react";
import { AppContext, type AppContextValue } from "../hooks/useAppContext";
import MetricsModule from "./MetricsModule";

vi.mock("./DeviceMetricCard", () => ({
  default: ({ device, onClick }: { device: { mac: string; name: string }; onClick: () => void }) => (
    <div data-testid={`device-card-${device.mac}`}>
      <button onClick={onClick}>{device.name}</button>
    </div>
  ),
}));

vi.mock("./MetricsDetailView", () => ({
  default: ({ device, onBack }: { device: { name: string }; onBack: () => void }) => (
    <div data-testid="detail-view">
      <span>{device.name}</span>
      <button onClick={onBack}>Back to overview</button>
    </div>
  ),
}));

const devicesMock = vi.hoisted(() => ({
  data: {
    devices: [
      { mac: "aa:01", name: "Gateway", model: "UDM-Pro", type: "gateway", cpu: 12, mem: 45, temperature: 52, uptime: 86400, tx_bytes: 1024, rx_bytes: 2048, num_sta: 5, version: "4.0.6", poe_consumption: null, status: "online" },
      { mac: "aa:02", name: "Switch", model: "USW-24", type: "switch", cpu: 8, mem: 30, temperature: null, uptime: 43200, tx_bytes: 512, rx_bytes: 768, num_sta: 10, version: "7.1.0", poe_consumption: 45.2, status: "online" },
    ],
  } as { devices: Array<Record<string, unknown>> } | undefined,
  isLoading: false,
  error: null as Error | null,
}));

const historyMock = vi.hoisted(() => ({
  data: { mac: "aa:01", history: [] } as { mac: string; history: Array<Record<string, unknown>> } | undefined,
  isLoading: false,
  error: null as Error | null,
}));

const notificationsMock = vi.hoisted(() => ({
  data: [] as Array<Record<string, unknown>> | undefined,
  isLoading: false,
  error: null as Error | null,
}));

vi.mock("../hooks/queries", async () => {
  const actual = await vi.importActual("../hooks/queries");
  return {
    ...actual,
    useMetricsDevices: () => devicesMock,
    useMetricsHistory: () => historyMock,
    useNotifications: () => notificationsMock,
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
        <MetricsModule />
      </MemoryRouter>
    </AppContext.Provider>,
  );
}

beforeEach(() => {
  devicesMock.data = {
    devices: [
      { mac: "aa:01", name: "Gateway", model: "UDM-Pro", type: "gateway", cpu: 12, mem: 45, temperature: 52, uptime: 86400, tx_bytes: 1024, rx_bytes: 2048, num_sta: 5, version: "4.0.6", poe_consumption: null, status: "online" },
      { mac: "aa:02", name: "Switch", model: "USW-24", type: "switch", cpu: 8, mem: 30, temperature: null, uptime: 43200, tx_bytes: 512, rx_bytes: 768, num_sta: 10, version: "7.1.0", poe_consumption: 45.2, status: "online" },
    ],
  };
  devicesMock.isLoading = false;
  devicesMock.error = null;
  historyMock.data = { mac: "aa:01", history: [] };
  historyMock.isLoading = false;
  historyMock.error = null;
  notificationsMock.data = [];
  notificationsMock.isLoading = false;
  notificationsMock.error = null;
});

describe("MetricsModule", () => {
  it("renders device cards in grid view", () => {
    renderModule();
    expect(screen.getByTestId("device-card-aa:01")).toBeInTheDocument();
    expect(screen.getByTestId("device-card-aa:02")).toBeInTheDocument();
  });

  it("shows auto-refresh label in toolbar", () => {
    renderModule();
    expect(screen.getByText("Auto-refreshes every 30s")).toBeInTheDocument();
  });

  it("shows loading state when devices are loading", () => {
    devicesMock.data = undefined;
    devicesMock.isLoading = true;
    renderModule();
    expect(screen.getByText("Loading devices...")).toBeInTheDocument();
  });

  it("shows error state when devices query fails", () => {
    devicesMock.data = undefined;
    devicesMock.error = new Error("Connection refused");
    renderModule();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("shows empty state when no devices found", () => {
    devicesMock.data = { devices: [] };
    renderModule();
    expect(screen.getByText("No devices found")).toBeInTheDocument();
  });

  it("navigates to detail view when device card is clicked", () => {
    renderModule();
    fireEvent.click(screen.getByText("Gateway"));
    expect(screen.getByTestId("detail-view")).toBeInTheDocument();
    expect(screen.getByText("Gateway")).toBeInTheDocument();
  });

  it("returns to grid view when back is clicked in detail view", () => {
    renderModule();
    fireEvent.click(screen.getByText("Gateway"));
    expect(screen.getByTestId("detail-view")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Back to overview"));
    expect(screen.getByTestId("device-card-aa:01")).toBeInTheDocument();
  });

  it("shows error fallback for non-Error objects", () => {
    devicesMock.data = undefined;
    devicesMock.error = { message: "" } as Error;
    renderModule();
    expect(screen.getByText("Failed to load devices")).toBeInTheDocument();
  });

  it("deep-links to device from URL search param", () => {
    window.history.replaceState({}, "", "?device=aa:01");
    renderModule();
    expect(screen.getByTestId("detail-view")).toBeInTheDocument();
    expect(screen.getByText("Gateway")).toBeInTheDocument();
    // URL should be cleaned
    expect(window.location.search).toBe("");
  });
});
