import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ColorMode } from "@xyflow/react";
import { AppContext, type AppContextValue } from "../hooks/useAppContext";
import HealthModule from "./HealthModule";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const summaryMock = vi.hoisted(() => ({
  data: {
    firewall: {
      zone_pair_count: 5,
      grade_distribution: { A: 3, B: 2 },
      finding_count_by_severity: { low: 2 },
      uncovered_pairs: 1,
    },
    topology: {
      device_count_by_type: { gateway: 1, switch: 2 },
      offline_count: 0,
      firmware_mismatches: 0,
    },
    metrics: {
      active_notifications_by_severity: {},
      high_resource_devices: 0,
      recent_reboots: 0,
    },
  } as Record<string, unknown> | undefined,
  isLoading: false,
  error: null as Error | null,
}));

const analyzeMock = vi.hoisted(() => ({
  data: undefined as Record<string, unknown> | undefined,
  isPending: false,
  mutate: vi.fn(),
}));

vi.mock("../hooks/queries", async () => {
  const actual = await vi.importActual("../hooks/queries");
  return {
    ...actual,
    useHealthSummary: () => summaryMock,
    useHealthAnalysis: () => analyzeMock,
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
    aiInfo: { configured: true, provider: "openai", model: "gpt-4o" },
    aiConfigured: true,
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
        <HealthModule />
      </MemoryRouter>
    </AppContext.Provider>,
  );
}

beforeEach(() => {
  summaryMock.data = {
    firewall: {
      zone_pair_count: 5,
      grade_distribution: { A: 3, B: 2 },
      finding_count_by_severity: { low: 2 },
      uncovered_pairs: 1,
    },
    topology: {
      device_count_by_type: { gateway: 1, switch: 2 },
      offline_count: 0,
      firmware_mismatches: 0,
    },
    metrics: {
      active_notifications_by_severity: {},
      high_resource_devices: 0,
      recent_reboots: 0,
    },
  };
  summaryMock.isLoading = false;
  summaryMock.error = null;
  analyzeMock.data = undefined;
  analyzeMock.isPending = false;
  analyzeMock.mutate = vi.fn();
  mockNavigate.mockClear();
});

describe("HealthModule", () => {
  it("renders summary cards with data", () => {
    renderModule();
    expect(screen.getByText("Firewall")).toBeInTheDocument();
    expect(screen.getByText("Topology")).toBeInTheDocument();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument(); // zone pair count
  });

  it("shows auto-refresh label", () => {
    renderModule();
    expect(screen.getByText("Auto-refreshes every 60s")).toBeInTheDocument();
  });

  it("shows loading state when summary is loading", () => {
    summaryMock.data = undefined;
    summaryMock.isLoading = true;
    renderModule();
    expect(screen.getByText("Loading summary...")).toBeInTheDocument();
  });

  it("shows error state when summary fails", () => {
    summaryMock.data = undefined;
    summaryMock.error = new Error("Connection refused");
    renderModule();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("shows error fallback for non-Error objects", () => {
    summaryMock.data = undefined;
    summaryMock.error = { message: "" } as Error;
    renderModule();
    expect(screen.getByText("Failed to load summary")).toBeInTheDocument();
  });

  it("shows analyze button when AI is configured", () => {
    renderModule();
    expect(screen.getByText("Analyze Site Health")).toBeInTheDocument();
  });

  it("shows setup message when AI is not configured", () => {
    renderModule({ aiConfigured: false });
    expect(screen.getByText(/Configure an AI provider/)).toBeInTheDocument();
  });

  it("calls mutate when analyze button is clicked", () => {
    renderModule();
    fireEvent.click(screen.getByText("Analyze Site Health"));
    expect(analyzeMock.mutate).toHaveBeenCalled();
  });

  it("shows analyzing spinner when mutation is pending", () => {
    analyzeMock.isPending = true;
    renderModule();
    expect(screen.getByText("Running cross-domain analysis...")).toBeInTheDocument();
    expect(screen.getByText("Analyzing...")).toBeInTheDocument();
  });

  it("shows findings when analysis succeeds", () => {
    analyzeMock.data = {
      status: "ok",
      findings: [
        {
          severity: "high",
          title: "Switch under load",
          description: "Switch is sole uplink with high CPU.",
          affected_module: "topology",
          affected_entity_id: "aa:bb",
          recommended_action: "Add redundancy.",
          confidence: "high",
        },
      ],
      cached: false,
      analyzed_at: new Date().toISOString(),
      message: null,
    };
    renderModule();
    expect(screen.getByText("Switch under load")).toBeInTheDocument();
    expect(screen.getByText("topology")).toBeInTheDocument();
    expect(screen.getByText("Add redundancy.")).toBeInTheDocument();
  });

  it("shows error when analysis fails", () => {
    analyzeMock.data = {
      status: "error",
      findings: [],
      cached: false,
      analyzed_at: null,
      message: "Provider returned HTTP 500",
    };
    renderModule();
    expect(screen.getByText("Provider returned HTTP 500")).toBeInTheDocument();
  });

  it("shows success message when no findings", () => {
    analyzeMock.data = {
      status: "ok",
      findings: [],
      cached: false,
      analyzed_at: new Date().toISOString(),
      message: null,
    };
    renderModule();
    expect(screen.getByText("No cross-domain issues found.")).toBeInTheDocument();
  });

  it("shows Re-analyze button after first analysis", () => {
    analyzeMock.data = {
      status: "ok",
      findings: [],
      cached: false,
      analyzed_at: new Date().toISOString(),
      message: null,
    };
    renderModule();
    expect(screen.getByText("Re-analyze")).toBeInTheDocument();
  });

  it("navigates to firewall when firewall card is clicked", () => {
    renderModule();
    fireEvent.click(screen.getByText("Firewall"));
    expect(mockNavigate).toHaveBeenCalledWith("/firewall");
  });

  it("navigates to module when finding is clicked", () => {
    analyzeMock.data = {
      status: "ok",
      findings: [
        {
          severity: "medium",
          title: "IoT exposure",
          description: "IoT zone issue.",
          affected_module: "firewall",
          affected_entity_id: "IoT->External",
          recommended_action: "Restrict egress.",
          confidence: "medium",
        },
      ],
      cached: false,
      analyzed_at: new Date().toISOString(),
      message: null,
    };
    renderModule();
    fireEvent.click(screen.getByText("IoT exposure"));
    expect(mockNavigate).toHaveBeenCalledWith("/firewall");
  });

  it("groups findings by severity", () => {
    analyzeMock.data = {
      status: "ok",
      findings: [
        { severity: "low", title: "Low issue", description: "d", affected_module: "", affected_entity_id: "", recommended_action: "", confidence: "" },
        { severity: "high", title: "High issue", description: "d", affected_module: "", affected_entity_id: "", recommended_action: "", confidence: "" },
      ],
      cached: false,
      analyzed_at: new Date().toISOString(),
      message: null,
    };
    renderModule();
    // High severity group should appear before low
    const highHeader = screen.getByText("high (1)");
    const lowHeader = screen.getByText("low (1)");
    expect(highHeader.compareDocumentPosition(lowHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("navigates to topology when topology card is clicked", () => {
    renderModule();
    fireEvent.click(screen.getByText("Topology"));
    expect(mockNavigate).toHaveBeenCalledWith("/topology");
  });

  it("navigates to metrics when metrics card is clicked", () => {
    renderModule();
    fireEvent.click(screen.getByText("Metrics"));
    expect(mockNavigate).toHaveBeenCalledWith("/metrics");
  });

  it("does not navigate for unknown module in finding", () => {
    analyzeMock.data = {
      status: "ok",
      findings: [
        { severity: "high", title: "Unknown", description: "d", affected_module: "unknown", affected_entity_id: "", recommended_action: "", confidence: "" },
      ],
      cached: false,
      analyzed_at: new Date().toISOString(),
      message: null,
    };
    renderModule();
    fireEvent.click(screen.getByText("Unknown"));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows danger border on firewall card when grade F exists", () => {
    summaryMock.data = {
      ...summaryMock.data!,
      firewall: { zone_pair_count: 1, grade_distribution: { F: 1 }, finding_count_by_severity: {}, uncovered_pairs: 0 },
    };
    renderModule();
    const firewallCard = screen.getByText("Firewall").closest("button");
    expect(firewallCard?.className).toContain("border-status-danger");
  });

  it("shows warning border on topology card with firmware mismatches", () => {
    summaryMock.data = {
      ...summaryMock.data!,
      topology: { device_count_by_type: { gateway: 1 }, offline_count: 0, firmware_mismatches: 2 },
    };
    renderModule();
    const topoCard = screen.getByText("Topology").closest("button");
    expect(topoCard?.className).toContain("border-status-warning");
  });

  it("shows danger border on topology card when devices offline", () => {
    summaryMock.data = {
      ...summaryMock.data!,
      topology: { device_count_by_type: { gateway: 1 }, offline_count: 1, firmware_mismatches: 0 },
    };
    renderModule();
    const topoCard = screen.getByText("Topology").closest("button");
    expect(topoCard?.className).toContain("border-status-danger");
  });

  it("shows danger border on metrics card with high resource devices", () => {
    summaryMock.data = {
      ...summaryMock.data!,
      metrics: { active_notifications_by_severity: {}, high_resource_devices: 2, recent_reboots: 0 },
    };
    renderModule();
    const metricsCard = screen.getByText("Metrics").closest("button");
    expect(metricsCard?.className).toContain("border-status-danger");
  });

  it("shows warning border on metrics card with recent reboots", () => {
    summaryMock.data = {
      ...summaryMock.data!,
      metrics: { active_notifications_by_severity: {}, high_resource_devices: 0, recent_reboots: 1 },
    };
    renderModule();
    const metricsCard = screen.getByText("Metrics").closest("button");
    expect(metricsCard?.className).toContain("border-status-warning");
  });

  it("shows danger for metrics card with critical notifications", () => {
    summaryMock.data = {
      ...summaryMock.data!,
      metrics: { active_notifications_by_severity: { critical: 1 }, high_resource_devices: 0, recent_reboots: 0 },
    };
    renderModule();
    const metricsCard = screen.getByText("Metrics").closest("button");
    expect(metricsCard?.className).toContain("border-status-danger");
  });

  it("shows warning for metrics card with medium notifications", () => {
    summaryMock.data = {
      ...summaryMock.data!,
      metrics: { active_notifications_by_severity: { medium: 1 }, high_resource_devices: 0, recent_reboots: 0 },
    };
    renderModule();
    const metricsCard = screen.getByText("Metrics").closest("button");
    expect(metricsCard?.className).toContain("border-status-warning");
  });

  it("shows warning border on firewall card with grade D", () => {
    summaryMock.data = {
      ...summaryMock.data!,
      firewall: { zone_pair_count: 2, grade_distribution: { A: 1, D: 1 }, finding_count_by_severity: {}, uncovered_pairs: 0 },
    };
    renderModule();
    const fwCard = screen.getByText("Firewall").closest("button");
    expect(fwCard?.className).toContain("border-status-warning");
  });

  it("shows last analyzed timestamp in minutes", () => {
    const pastDate = new Date(Date.now() - 120_000).toISOString();
    analyzeMock.data = { status: "ok", findings: [], cached: true, analyzed_at: pastDate, message: null };
    renderModule();
    expect(screen.getByText(/Last analyzed: 2m ago/)).toBeInTheDocument();
  });

  it("shows last analyzed timestamp in hours", () => {
    const pastDate = new Date(Date.now() - 3_600_000 * 3).toISOString(); // 3h ago
    analyzeMock.data = { status: "ok", findings: [], cached: true, analyzed_at: pastDate, message: null };
    renderModule();
    expect(screen.getByText(/Last analyzed: 3h ago/)).toBeInTheDocument();
  });

  it("shows last analyzed timestamp in days", () => {
    const pastDate = new Date(Date.now() - 86_400_000 * 2).toISOString(); // 2d ago
    analyzeMock.data = { status: "ok", findings: [], cached: true, analyzed_at: pastDate, message: null };
    renderModule();
    expect(screen.getByText(/Last analyzed: 2d ago/)).toBeInTheDocument();
  });

  it("shows critical severity findings", () => {
    analyzeMock.data = {
      status: "ok",
      findings: [
        { severity: "critical", title: "Critical issue", description: "d", affected_module: "firewall", affected_entity_id: "", recommended_action: "", confidence: "" },
      ],
      cached: false,
      analyzed_at: new Date().toISOString(),
      message: null,
    };
    renderModule();
    expect(screen.getByText("critical (1)")).toBeInTheDocument();
    expect(screen.getByText("Critical issue")).toBeInTheDocument();
  });

  it("renders null when no summary and not loading", () => {
    summaryMock.data = undefined;
    summaryMock.isLoading = false;
    summaryMock.error = null;
    renderModule();
    // Should not show summary cards or loading
    expect(screen.queryByText("Firewall")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading summary...")).not.toBeInTheDocument();
  });
});
