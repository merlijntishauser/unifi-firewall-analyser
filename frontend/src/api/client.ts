import type {
  AiAnalysisSettings,
  AiAnalyzeRequest,
  AiAnalyzeResponse,
  AiConfig,
  AiConfigInput,
  AiPreset,
  AuthStatus,
  Rule,
  SimulateRequest,
  SimulateResponse,
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
  getZones: () => fetchJson<Zone[]>("/zones"),
  getRules: () => fetchJson<Rule[]>("/rules"),
  getZonePairs: () => fetchJson<ZonePair[]>("/zone-pairs"),
  simulate: (req: SimulateRequest) =>
    fetchJson<SimulateResponse>("/simulate", {
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
  testAiConnection: () =>
    fetchJson<{ status: string }>("/settings/ai/test", { method: "POST" }),
  getAiPresets: () => fetchJson<AiPreset[]>("/settings/ai/presets"),
  getAiAnalysisSettings: () =>
    fetchJson<AiAnalysisSettings>("/settings/ai-analysis"),
  saveAiAnalysisSettings: (settings: AiAnalysisSettings) =>
    fetchJson("/settings/ai-analysis", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  analyzeWithAi: (req: AiAnalyzeRequest) =>
    fetchJson<AiAnalyzeResponse>("/analyze", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  getZoneFilter: () => fetchJson<ZoneFilter>("/settings/zone-filter"),
  saveZoneFilter: (hiddenZoneIds: string[]) =>
    fetchJson("/settings/zone-filter", {
      method: "PUT",
      body: JSON.stringify({ hidden_zone_ids: hiddenZoneIds }),
    }),
  toggleRule: (ruleId: string, enabled: boolean) =>
    fetchJson(`/rules/${ruleId}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  swapRuleOrder: (policyIdA: string, policyIdB: string) =>
    fetchJson("/rules/reorder", {
      method: "PUT",
      body: JSON.stringify({ policy_id_a: policyIdA, policy_id_b: policyIdB }),
    }),
};
