import type {
  AiAnalysisSettings,
  AiAnalyzeRequest,
  AiAnalyzeResponse,
  AiConfig,
  AiConfigInput,
  AiPreset,
  AppAuthStatus,
  AppNotification,
  AuthStatus,
  HealthAnalysisResult,
  HealthSummaryResponse,
  MetricsDevicesResponse,
  MetricsHistoryResponse,
  Rule,
  SimulateRequest,
  SimulateResponse,
  TopologyDevicesResponse,
  TopologySvgResponse,
  Zone,
  ZoneFilter,
  ZonePair,
} from "./types";

const BASE = "/api";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  getAppAuthStatus: () => fetchJson<AppAuthStatus>("/auth/app-status"),
  appLogin: (password: string) =>
    fetchJson("/auth/app-login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  getAuthStatus: () => fetchJson<AuthStatus>("/auth/status"),
  login: (
    url: string,
    username: string,
    password: string,
    site: string,
    verifySsl: boolean,
  ) =>
    fetchJson("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        url,
        username,
        password,
        site,
        verify_ssl: verifySsl,
      }),
    }),
  logout: () => fetchJson("/auth/logout", { method: "POST" }),
  getZones: () => fetchJson<Zone[]>("/firewall/zones"),
  getRules: () => fetchJson<Rule[]>("/firewall/rules"),
  getZonePairs: () => fetchJson<ZonePair[]>("/firewall/zone-pairs"),
  simulate: (req: SimulateRequest) =>
    fetchJson<SimulateResponse>("/firewall/simulate", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  getAiConfig: () => fetchJson<AiConfig>("/settings/ai"),
  saveAiConfig: (config: AiConfigInput) =>
    fetchJson("/settings/ai", {
      method: "PUT",
      body: JSON.stringify(config),
    }),
  deleteAiConfig: () => fetchJson("/settings/ai", { method: "DELETE" }),
  testAiConnection: (config?: AiConfigInput) =>
    fetchJson<{ status: string }>("/settings/ai/test", {
      method: "POST",
      body: config ? JSON.stringify(config) : undefined,
    }),
  getAiPresets: () => fetchJson<AiPreset[]>("/settings/ai/presets"),
  getAiAnalysisSettings: () =>
    fetchJson<AiAnalysisSettings>("/settings/ai-analysis"),
  saveAiAnalysisSettings: (settings: AiAnalysisSettings) =>
    fetchJson("/settings/ai-analysis", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  analyzeWithAi: (req: AiAnalyzeRequest) =>
    fetchJson<AiAnalyzeResponse>("/firewall/analyze", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  getZoneFilter: () => fetchJson<ZoneFilter>("/firewall/zone-filter"),
  saveZoneFilter: (hiddenZoneIds: string[]) =>
    fetchJson("/firewall/zone-filter", {
      method: "PUT",
      body: JSON.stringify({ hidden_zone_ids: hiddenZoneIds }),
    }),
  toggleRule: (ruleId: string, enabled: boolean) =>
    fetchJson(`/firewall/rules/${ruleId}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  swapRuleOrder: (policyIdA: string, policyIdB: string) =>
    fetchJson("/firewall/rules/reorder", {
      method: "PUT",
      body: JSON.stringify({ policy_id_a: policyIdA, policy_id_b: policyIdB }),
    }),
  getTopologySvg: (colorMode: string, projection: string) =>
    fetchJson<TopologySvgResponse>(
      `/topology/svg?color_mode=${encodeURIComponent(colorMode)}&projection=${encodeURIComponent(projection)}`,
    ),
  getTopologyDevices: () => fetchJson<TopologyDevicesResponse>("/topology/devices"),
  getMetricsDevices: () => fetchJson<MetricsDevicesResponse>("/metrics/devices"),
  getMetricsHistory: (mac: string) =>
    fetchJson<MetricsHistoryResponse>(`/metrics/devices/${encodeURIComponent(mac)}/history`),
  getNotifications: () => fetchJson<AppNotification[]>("/metrics/notifications"),
  dismissNotification: (id: number) =>
    fetchJson(`/metrics/notifications/${id}/dismiss`, { method: "POST" }),
  getHealthSummary: () => fetchJson<HealthSummaryResponse>("/health/summary"),
  analyzeHealth: () =>
    fetchJson<HealthAnalysisResult>("/health/analyze", { method: "POST" }),
};
