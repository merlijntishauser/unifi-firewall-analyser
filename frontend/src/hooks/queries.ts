import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { AiAnalyzeRequest, AiConfigInput, SimulateRequest } from "../api/types";

export const queryKeys = {
  zones: ["zones"] as const,
  zonePairs: ["zone-pairs"] as const,
  appAuthStatus: ["app-auth-status"] as const,
  authStatus: ["auth-status"] as const,
  aiConfig: ["ai-config"] as const,
  zoneFilter: ["zone-filter"] as const,
  topologySvg: (colorMode: string, projection: string) => ["topology-svg", colorMode, projection] as const,
  topologyDevices: ["topology-devices"] as const,
};

// --- Queries ---

export function useAppAuthStatus() {
  return useQuery({
    queryKey: queryKeys.appAuthStatus,
    queryFn: api.getAppAuthStatus,
  });
}

export function useAuthStatus(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.authStatus,
    queryFn: api.getAuthStatus,
    enabled,
  });
}

export function useZones(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.zones,
    queryFn: api.getZones,
    enabled,
  });
}

export function useZonePairs(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.zonePairs,
    queryFn: api.getZonePairs,
    enabled,
  });
}

export function useAiConfig(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.aiConfig,
    queryFn: api.getAiConfig,
    enabled,
  });
}

export function useZoneFilter(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.zoneFilter,
    queryFn: api.getZoneFilter,
    enabled,
  });
}

/* v8 ignore start -- mocked at hook level in component tests */
export function useTopologySvg(colorMode: string, projection: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.topologySvg(colorMode, projection),
    queryFn: () => api.getTopologySvg(colorMode, projection),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTopologyDevices(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.topologyDevices,
    queryFn: api.getTopologyDevices,
    enabled,
    staleTime: 30 * 1000,
  });
}
/* v8 ignore stop */

// --- Mutations ---

export function useAppLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => api.appLogin(password),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.appAuthStatus }),
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { url: string; username: string; password: string; site: string; verifySsl: boolean }) =>
      api.login(vars.url, vars.username, vars.password, vars.site, vars.verifySsl),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.authStatus }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      qc.setQueryData(queryKeys.authStatus, undefined);
      qc.invalidateQueries({ queryKey: queryKeys.authStatus });
    },
  });
}

export function useToggleRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { ruleId: string; enabled: boolean }) =>
      api.toggleRule(vars.ruleId, vars.enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.zonePairs }),
  });
}

export function useSwapRuleOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { policyIdA: string; policyIdB: string }) =>
      api.swapRuleOrder(vars.policyIdA, vars.policyIdB),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.zonePairs }),
  });
}

export function useSaveAiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: AiConfigInput) => api.saveAiConfig(config),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.aiConfig }),
  });
}

export function useDeleteAiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteAiConfig(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.aiConfig }),
  });
}

export function useSaveZoneFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hiddenZoneIds: string[]) => api.saveZoneFilter(hiddenZoneIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.zoneFilter }),
  });
}

export function useSimulate() {
  return useMutation({
    mutationFn: (req: SimulateRequest) => api.simulate(req),
  });
}

export function useAnalyzeWithAi() {
  return useMutation({
    mutationFn: (req: AiAnalyzeRequest) => api.analyzeWithAi(req),
  });
}
