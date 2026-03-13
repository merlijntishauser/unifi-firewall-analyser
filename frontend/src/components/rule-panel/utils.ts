import type { Rule, SimulateRequest } from "../../api/types";

export function gradeColor(grade: string): string {
  if (grade === "A" || grade === "B") return "bg-status-success";
  if (grade === "C") return "bg-status-warning";
  return "bg-status-danger";
}

export function actionColor(action: Rule["action"], enabled: boolean): string {
  if (!enabled) return "bg-gray-50 dark:bg-noc-raised/50 border-gray-200 dark:border-noc-border";
  switch (action) {
    case "ALLOW":
      return "bg-green-50 dark:bg-status-success/6 border-green-200 dark:border-status-success/20";
    case "BLOCK":
    case "REJECT":
      return "bg-red-50 dark:bg-status-danger/6 border-red-200 dark:border-status-danger/20";
  }
}

export function actionBadge(action: Rule["action"]): string {
  switch (action) {
    case "ALLOW":
      return "bg-green-100 dark:bg-status-success/15 text-green-800 dark:text-status-success";
    case "BLOCK":
      return "bg-red-100 dark:bg-status-danger/15 text-red-800 dark:text-status-danger";
    case "REJECT":
      return "bg-red-100 dark:bg-status-danger/15 text-red-800 dark:text-status-danger";
  }
}

export function verdictColor(verdict: string | null): string {
  switch (verdict) {
    case "ALLOW":
      return "bg-green-50 dark:bg-status-success/10 border-green-300 dark:border-status-success/30 text-green-800 dark:text-status-success";
    case "BLOCK":
    case "REJECT":
      return "bg-red-50 dark:bg-status-danger/10 border-red-300 dark:border-status-danger/30 text-red-800 dark:text-status-danger";
    default:
      return "bg-gray-50 dark:bg-noc-raised border-gray-300 dark:border-noc-border text-gray-700 dark:text-noc-text-secondary";
  }
}

export function resolveGrouped(direct: string[], group: string, members: string[], fallback = "any"): { value: string; note: string } {
  if (group && members.length > 0) return { value: members.join(", "), note: group };
  return { value: direct.length > 0 ? direct.join(", ") : fallback, note: "" };
}

export function formatSchedule(raw: string): string {
  if (!raw) return "";
  const normalized = raw.replace(/'/g, '"').replace(/True/g, "true").replace(/False/g, "false");
  try {
    const parsed = JSON.parse(normalized) as Record<string, unknown>;
    if (parsed.mode === "ALWAYS") return "";
    return String(parsed.mode ?? raw);
  } catch {
    return raw;
  }
}

export function formatIpSec(raw: string): string {
  if (!raw || raw === "False" || raw === "false" || raw === "MATCH_NONE") return "";
  if (raw === "MATCH_IPSEC" || raw === "True" || raw === "true") return "Required";
  if (raw === "MATCH_NON_IPSEC") return "Excluded";
  return raw;
}

export interface SimFormState {
  srcIp: string;
  dstIp: string;
  protocol: string;
  port: string;
  sourcePort: string;
}

export const initialFormState: SimFormState = {
  srcIp: "",
  dstIp: "",
  protocol: "TCP",
  port: "",
  sourcePort: "",
};

export function formReducer(state: SimFormState, update: Partial<SimFormState>): SimFormState {
  return { ...state, ...update };
}

export function buildSimulateRequest(form: SimFormState): SimulateRequest {
  return {
    src_ip: form.srcIp,
    dst_ip: form.dstIp,
    protocol: form.protocol === "Any" ? "all" : form.protocol.toLowerCase(),
    port: form.port ? Number(form.port) : null,
    source_port: form.sourcePort ? Number(form.sourcePort) : null,
  };
}

export function deriveAiError(error: Error | null, data: { status: string; message?: string } | undefined): string | null {
  if (error) return error instanceof Error ? error.message : "AI analysis failed";
  if (data?.status === "error") return data.message ?? "AI analysis failed";
  return null;
}

export function deriveMutationError(error: unknown, fallback: string): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : fallback;
}
