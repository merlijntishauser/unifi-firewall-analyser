import { useMemo, useReducer, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";
import type { ZonePair, Rule, Finding, SimulateResponse } from "../api/types";
import ConfirmDialog from "./ConfirmDialog";

interface RulePanelProps {
  pair: ZonePair;
  sourceZoneName: string;
  destZoneName: string;
  aiConfigured: boolean;
  onClose: () => void;
  onRuleUpdated: () => void;
}

interface RulePanelState {
  srcIp: string;
  dstIp: string;
  protocol: string;
  port: string;
  sourcePort: string;
  simLoading: boolean;
  simResult: SimulateResponse | null;
  simError: string | null;
  aiLoading: boolean;
  aiError: string | null;
  aiFindings: Finding[];
  writeLoading: string | null;
  writeError: string | null;
}

const initialState: RulePanelState = {
  srcIp: "",
  dstIp: "",
  protocol: "TCP",
  port: "",
  sourcePort: "",
  simLoading: false,
  simResult: null,
  simError: null,
  aiLoading: false,
  aiError: null,
  aiFindings: [],
  writeLoading: null,
  writeError: null,
};

function rulePanelReducer(state: RulePanelState, update: Partial<RulePanelState>): RulePanelState {
  return { ...state, ...update };
}

function gradeColor(grade: string): string {
  if (grade === "A" || grade === "B") return "bg-status-success";
  if (grade === "C") return "bg-status-warning";
  return "bg-status-danger";
}

function severityBadge(severity: string): string {
  switch (severity) {
    case "high":
      return "bg-red-100 dark:bg-status-danger-dim text-red-700 dark:text-status-danger";
    case "medium":
      return "bg-amber-100 dark:bg-status-warning-dim text-amber-700 dark:text-status-warning";
    case "low":
      return "bg-blue-100 dark:bg-ub-blue-dim text-blue-700 dark:text-ub-blue";
    default:
      return "bg-gray-100 dark:bg-noc-raised text-gray-700 dark:text-noc-text-secondary";
  }
}

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function FindingCard({ finding }: { finding: Finding }) {
  const [showRationale, setShowRationale] = useState(false);
  return (
    <div className="rounded-lg border border-gray-200 dark:border-noc-border p-2.5 text-xs bg-gray-50 dark:bg-noc-raised/50">
      <div className="flex items-center gap-1.5">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadge(finding.severity)}`}>
          {finding.severity}
        </span>
        {finding.source === "ai" && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 dark:bg-ub-purple/15 text-purple-700 dark:text-ub-purple-light">
            AI
          </span>
        )}
        <span className="font-medium text-gray-900 dark:text-noc-text">{finding.title}</span>
      </div>
      <p className="mt-1 text-gray-500 dark:text-noc-text-secondary">{finding.description}</p>
      {finding.rationale && (
        <>
          <button
            onClick={() => setShowRationale(!showRationale)}
            className="mt-1 text-[10px] font-medium text-ub-blue hover:text-ub-blue-light cursor-pointer transition-colors"
          >
            {showRationale ? "Hide" : "Why?"}
          </button>
          {showRationale && (
            <p className="mt-1 pl-2 border-l-2 border-ub-blue/30 text-gray-500 dark:text-noc-text-secondary text-[11px] animate-fade-in">
              {finding.rationale}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function FindingsList({ findings }: { findings: Finding[] }) {
  const sorted = useMemo(() => {
    return [...findings].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
    );
  }, [findings]);

  return (
    <div className="space-y-1.5">
      <h3 className="text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">
        Findings ({findings.length})
      </h3>
      {sorted.map((finding, idx) => (
        <FindingCard key={finding.id ?? idx} finding={finding} />
      ))}
    </div>
  );
}

function actionColor(action: Rule["action"], enabled: boolean): string {
  if (!enabled) return "bg-gray-50 dark:bg-noc-raised/50 border-gray-200 dark:border-noc-border";
  switch (action) {
    case "ALLOW":
      return "bg-green-50 dark:bg-status-success/6 border-green-200 dark:border-status-success/20";
    case "BLOCK":
    case "REJECT":
      return "bg-red-50 dark:bg-status-danger/6 border-red-200 dark:border-status-danger/20";
  }
}

function actionBadge(action: Rule["action"]): string {
  switch (action) {
    case "ALLOW":
      return "bg-green-100 dark:bg-status-success/15 text-green-800 dark:text-status-success";
    case "BLOCK":
      return "bg-red-100 dark:bg-status-danger/15 text-red-800 dark:text-status-danger";
    case "REJECT":
      return "bg-red-100 dark:bg-status-danger/15 text-red-800 dark:text-status-danger";
  }
}

function verdictColor(verdict: string | null): string {
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

const LABEL_CLASS = "text-[11px] font-medium text-gray-500 dark:text-noc-text-secondary whitespace-nowrap";

interface DetailRow {
  label: string;
  value: string;
  type: "text" | "mono" | "status";
  note?: string;
  active?: boolean;
}

interface DetailSection {
  title: string;
  rows: DetailRow[];
}

/** Resolve direct values vs. firewall group members into a single display value. */
function resolveGrouped(direct: string[], group: string, members: string[], fallback = "any"): { value: string; note: string } {
  if (group && members.length > 0) return { value: members.join(", "), note: group };
  return { value: direct.length > 0 ? direct.join(", ") : fallback, note: "" };
}

/** Parse schedule strings -- hide "ALWAYS" (default), format others. */
function formatSchedule(raw: string): string {
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

/** Normalize IPSec match values -- hide non-meaningful ones. */
function formatIpSec(raw: string): string {
  if (!raw || raw === "False" || raw === "false" || raw === "MATCH_NONE") return "";
  if (raw === "MATCH_IPSEC" || raw === "True" || raw === "true") return "Required";
  if (raw === "MATCH_NON_IPSEC") return "Excluded";
  return raw;
}

function buildDetailSections(rule: Rule, sourceZoneName: string, destZoneName: string): DetailSection[] {
  const sections: DetailSection[] = [];

  const dstPorts = resolveGrouped(rule.port_ranges, rule.destination_port_group, rule.destination_port_group_members);
  const dstIps = resolveGrouped(rule.ip_ranges, rule.destination_address_group, rule.destination_address_group_members);
  const matchRows: DetailRow[] = [
    { label: "Action", value: rule.action, type: "mono" },
    { label: "Protocol", value: rule.protocol || "any", type: "mono" },
    { label: "Source", value: sourceZoneName, type: "text" },
    { label: "Dst Ports", value: dstPorts.value, type: "mono", note: dstPorts.note },
    { label: "Dst IPs", value: dstIps.value, type: "mono", note: dstIps.note },
    { label: "Destination", value: destZoneName, type: "text" },
  ];

  const srcPorts = resolveGrouped(rule.source_port_ranges, rule.source_port_group, rule.source_port_group_members, "");
  if (srcPorts.value) matchRows.push({ label: "Src Ports", value: srcPorts.value, type: "mono", note: srcPorts.note });
  const srcIps = resolveGrouped(rule.source_ip_ranges, rule.source_address_group, rule.source_address_group_members, "");
  if (srcIps.value) matchRows.push({ label: "Src IPs", value: srcIps.value, type: "mono", note: srcIps.note });
  const optionalFilters: [string, string][] = [
    ["Src MACs", rule.source_mac_addresses.join(", ")],
    ["Dst MACs", rule.destination_mac_addresses.join(", ")],
  ];
  for (const [label, value] of optionalFilters) {
    if (value) matchRows.push({ label, value, type: "mono" });
  }
  sections.push({ title: "Match Criteria", rows: matchRows });

  const metaRows: DetailRow[] = [
    { label: "Status", value: rule.enabled ? "Enabled" : "Disabled", type: "status", active: rule.enabled },
    { label: "Logging", value: rule.connection_logging ? "Enabled" : "Disabled", type: "status", active: rule.connection_logging },
  ];
  if (rule.connection_state_type) metaRows.push({ label: "Conn State", value: rule.connection_state_type, type: "mono" });
  const schedule = formatSchedule(rule.schedule);
  if (schedule) metaRows.push({ label: "Schedule", value: schedule, type: "mono" });
  const ipSec = formatIpSec(rule.match_ip_sec);
  if (ipSec) metaRows.push({ label: "IPSec", value: ipSec, type: "mono" });
  if (rule.predefined) metaRows.push({ label: "Type", value: "Built-in (predefined)", type: "text" });
  metaRows.push({ label: "Index", value: String(rule.index), type: "mono" });
  sections.push({ title: "Metadata", rows: metaRows });

  return sections;
}

function RuleDetails({ rule, sourceZoneName, destZoneName }: { rule: Rule; sourceZoneName: string; destZoneName: string }) {
  const sections = buildDetailSections(rule, sourceZoneName, destZoneName);
  return (
    <div className="mt-2.5 pt-2 border-t border-gray-200/60 dark:border-noc-border/60 animate-fade-in">
      {rule.description && (
        <p className="mb-2 pl-2.5 border-l-2 border-gray-300 dark:border-noc-text-dim text-[11px] text-gray-500 dark:text-noc-text-secondary italic">
          {rule.description}
        </p>
      )}
      {sections.map((section) => (
        <DetailSectionView key={section.title} section={section} />
      ))}
      <div className="mt-2.5 pt-1.5 border-t border-gray-200/40 dark:border-noc-border/40 font-mono text-[10px] text-gray-400 dark:text-noc-text-dim select-all">
        ID: {rule.id}
      </div>
    </div>
  );
}

function DetailSectionView({ section }: { section: DetailSection }) {
  return (
    <div className="mt-2.5 first:mt-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-noc-text-dim whitespace-nowrap">
          {section.title}
        </span>
        <span className="flex-1 h-px bg-gray-200 dark:bg-noc-border" />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-baseline">
        {section.rows.map((row) => (
          <DetailRowView key={row.label} row={row} />
        ))}
      </dl>
    </div>
  );
}

function DetailRowView({ row }: { row: DetailRow }) {
  return (
    <>
      <dt className={LABEL_CLASS}>{row.label}</dt>
      {row.type === "status" ? (
        <dd className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${row.active ? "bg-status-success" : "bg-gray-300 dark:bg-noc-text-dim"}`} />
          <span className={`text-[11px] ${row.active ? "text-status-success" : "text-gray-400 dark:text-noc-text-dim"}`}>
            {row.value}
          </span>
        </dd>
      ) : row.type === "mono" ? (
        <dd>
          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-noc-raised text-gray-700 dark:text-noc-text inline-block">
            {row.value}
          </span>
          {row.note && (
            <span className="block text-[10px] text-gray-400 dark:text-noc-text-dim mt-0.5">
              {row.note}
            </span>
          )}
        </dd>
      ) : (
        <dd className="text-[11px] text-gray-700 dark:text-noc-text">{row.value}</dd>
      )}
    </>
  );
}

function RuleWriteControls({
  rule, idx, totalRules, writeDisabled, sortedRules, onToggle, onSwap,
}: {
  rule: Rule;
  idx: number;
  totalRules: number;
  writeDisabled: boolean;
  sortedRules: Rule[];
  onToggle: (rule: Rule) => void;
  onSwap: (ruleA: Rule, ruleB: Rule, direction: "up" | "down") => void;
}) {
  if (rule.predefined) return null;
  return (
    <>
      {idx > 0 && (
        <button
          aria-label={`Move ${rule.name} up`}
          onClick={(e) => { e.stopPropagation(); onSwap(sortedRules[idx - 1], rule, "up"); }}
          disabled={writeDisabled}
          className="p-0.5 text-gray-400 dark:text-noc-text-dim hover:text-gray-600 dark:hover:text-noc-text disabled:opacity-30 cursor-pointer transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 7.5l3.5-3.5 3.5 3.5" /></svg>
        </button>
      )}
      {idx < totalRules - 1 && (
        <button
          aria-label={`Move ${rule.name} down`}
          onClick={(e) => { e.stopPropagation(); onSwap(rule, sortedRules[idx + 1], "down"); }}
          disabled={writeDisabled}
          className="p-0.5 text-gray-400 dark:text-noc-text-dim hover:text-gray-600 dark:hover:text-noc-text disabled:opacity-30 cursor-pointer transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 4.5l3.5 3.5 3.5-3.5" /></svg>
        </button>
      )}
      <button
        aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
        onClick={(e) => { e.stopPropagation(); onToggle(rule); }}
        disabled={writeDisabled}
        className="relative w-7 h-4 rounded-full cursor-pointer transition-colors disabled:opacity-30"
        style={{ backgroundColor: rule.enabled ? "var(--color-status-success)" : "var(--color-noc-text-dim, #9ca3af)" }}
      >
        <span className={`absolute top-0.5 ${rule.enabled ? "left-3.5" : "left-0.5"} w-3 h-3 rounded-full bg-white shadow transition-all`} />
      </button>
    </>
  );
}

interface RuleCardProps {
  rule: Rule;
  idx: number;
  totalRules: number;
  isExpanded: boolean;
  isMatchedRule: boolean;
  isWriteLoading: boolean;
  writeDisabled: boolean;
  sourceZoneName: string;
  destZoneName: string;
  sortedRules: Rule[];
  onToggleExpand: () => void;
  onToggle: (rule: Rule) => void;
  onSwap: (ruleA: Rule, ruleB: Rule, direction: "up" | "down") => void;
}

function RuleCard({
  rule, idx, totalRules, isExpanded, isMatchedRule, isWriteLoading, writeDisabled,
  sourceZoneName, destZoneName, sortedRules, onToggleExpand, onToggle, onSwap,
}: RuleCardProps) {
  return (
    <div
      className={`rounded-lg border p-2.5 text-xs cursor-pointer transition-colors ${actionColor(rule.action, rule.enabled)} ${
        isMatchedRule ? "ring-2 ring-ub-blue" : ""
      } ${isWriteLoading ? "opacity-60 pointer-events-none animate-pulse" : ""}`}
      onClick={onToggleExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleExpand();
        }
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <svg
            className={`w-3 h-3 shrink-0 text-gray-400 dark:text-noc-text-dim transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4.5 2.5l3.5 3.5-3.5 3.5" />
          </svg>
          <span className="font-medium text-gray-900 dark:text-noc-text truncate">
            {idx + 1}. {rule.name}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <RuleWriteControls
            rule={rule}
            idx={idx}
            totalRules={totalRules}
            writeDisabled={writeDisabled}
            sortedRules={sortedRules}
            onToggle={onToggle}
            onSwap={onSwap}
          />
          {rule.predefined && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-noc-input text-gray-600 dark:text-noc-text-dim font-mono">
              built-in
            </span>
          )}
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${actionBadge(rule.action)}`}
          >
            {rule.action}
          </span>
        </div>
      </div>
      {(rule.protocol || rule.port_ranges.length > 0) && (
        <div className="mt-1 font-mono text-gray-500 dark:text-noc-text-secondary">
          {rule.protocol && <span>{rule.protocol}</span>}
          {rule.port_ranges.length > 0 && (
            <span className="ml-1">
              port {rule.port_ranges.join(", ")}
            </span>
          )}
        </div>
      )}
      {!rule.enabled && (
        <div className="mt-1 text-gray-400 dark:text-noc-text-dim italic">
          disabled
        </div>
      )}
      {isExpanded && (
        <RuleDetails rule={rule} sourceZoneName={sourceZoneName} destZoneName={destZoneName} />
      )}
    </div>
  );
}

function SimulationForm({
  state,
  dispatch,
  inputClass,
}: {
  state: RulePanelState;
  dispatch: React.Dispatch<Partial<RulePanelState>>;
  inputClass: string;
}) {
  async function handleSimulate(e: FormEvent) {
    e.preventDefault();
    dispatch({ simLoading: true, simError: null, simResult: null });
    try {
      const result = await api.simulate({
        src_ip: state.srcIp,
        dst_ip: state.dstIp,
        protocol: state.protocol === "Any" ? "all" : state.protocol.toLowerCase(),
        port: state.port ? Number(state.port) : null,
        source_port: state.sourcePort ? Number(state.sourcePort) : null,
      });
      dispatch({ simResult: result });
    } catch (err) {
      dispatch({ simError: err instanceof Error ? err.message : "Simulation failed" });
    } finally {
      dispatch({ simLoading: false });
    }
  }

  return (
    <form onSubmit={handleSimulate} className="space-y-2">
      <h3 className="text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">
        Packet Simulation
      </h3>
      <input
        type="text"
        placeholder="Source IP"
        value={state.srcIp}
        onChange={(e) => dispatch({ srcIp: e.target.value })}
        required
        className={inputClass}
      />
      <input
        type="text"
        placeholder="Destination IP"
        value={state.dstIp}
        onChange={(e) => dispatch({ dstIp: e.target.value })}
        required
        className={inputClass}
      />
      <div className="flex gap-2">
        <select
          value={state.protocol}
          onChange={(e) => dispatch({ protocol: e.target.value })}
          className={inputClass}
        >
          <option value="TCP">TCP</option>
          <option value="UDP">UDP</option>
          <option value="ICMP">ICMP</option>
          <option value="Any">Any</option>
        </select>
        <input
          type="number"
          placeholder="Port"
          value={state.port}
          onChange={(e) => dispatch({ port: e.target.value })}
          min={1}
          max={65535}
          className={inputClass}
        />
        <input
          type="number"
          placeholder="Src Port"
          value={state.sourcePort}
          onChange={(e) => dispatch({ sourcePort: e.target.value })}
          min={1}
          max={65535}
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={state.simLoading}
        className="w-full rounded-lg bg-ub-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-ub-blue-light focus:outline-none focus:ring-2 focus:ring-ub-blue/40 focus:ring-offset-1 dark:focus:ring-offset-noc-surface disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
      >
        {state.simLoading ? "Simulating..." : "Simulate"}
      </button>
    </form>
  );
}

function SimulationResult({ simResult, simError }: { simResult: SimulateResponse | null; simError: string | null }) {
  return (
    <>
      {simError && (
        <div className="rounded-lg bg-red-50 dark:bg-status-danger-dim border border-red-200 dark:border-status-danger/20 p-2.5 text-xs text-red-700 dark:text-status-danger">
          {simError}
        </div>
      )}

      {simResult && (
        <div className="space-y-2 animate-fade-in">
          {simResult.assumptions && simResult.assumptions.length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-status-warning-dim border border-amber-200 dark:border-status-warning/20 p-2.5 text-xs text-amber-700 dark:text-status-warning">
              <div className="font-semibold mb-1">Assumptions</div>
              <ul className="list-disc list-inside space-y-0.5">
                {simResult.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          <div
            className={`rounded-lg border p-3 text-center font-display font-semibold text-sm ${verdictColor(simResult.verdict)}`}
          >
            {simResult.verdict ?? "NO MATCH"}
            {simResult.default_policy_used && (
              <div className="text-xs font-normal mt-1 opacity-70 font-body">
                (default policy)
              </div>
            )}
          </div>

          {simResult.matched_rule_name && (
            <div className="text-xs text-gray-600 dark:text-noc-text-secondary">
              Matched:{" "}
              <span className="font-medium text-gray-900 dark:text-noc-text">
                {simResult.matched_rule_name}
              </span>
            </div>
          )}

          {simResult.evaluations.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">
                Evaluation Chain
              </h4>
              {simResult.evaluations.map((ev) => (
                <div
                  key={ev.rule_id}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                    ev.matched
                      ? "border-blue-300 dark:border-ub-blue/30 bg-blue-50 dark:bg-ub-blue-dim"
                      : ev.skipped_disabled
                        ? "border-gray-200 dark:border-noc-border bg-gray-50 dark:bg-noc-raised/50 opacity-50"
                        : "border-gray-200 dark:border-noc-border bg-gray-50 dark:bg-noc-raised/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700 dark:text-noc-text-secondary truncate">
                      {ev.rule_name}
                    </span>
                    <span
                      className={`shrink-0 ml-1 font-mono ${ev.matched ? "text-ub-blue font-semibold" : "text-gray-400 dark:text-noc-text-dim"}`}
                    >
                      {ev.matched ? "MATCH" : "skip"}
                    </span>
                  </div>
                  <div className="text-gray-400 dark:text-noc-text-dim mt-0.5">
                    {ev.reason}
                  </div>
                  {ev.unresolvable_constraints && ev.unresolvable_constraints.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {ev.unresolvable_constraints.map((c) => (
                        <div key={c} className="flex items-center gap-1 text-amber-600 dark:text-status-warning text-[10px]">
                          <span>&#9888;</span>
                          <span>{c}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function RulePanel({
  pair,
  sourceZoneName,
  destZoneName,
  aiConfigured,
  onClose,
  onRuleUpdated,
}: RulePanelProps) {
  const [state, dispatch] = useReducer(rulePanelReducer, initialState);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    action: () => Promise<void>;
  } | null>(null);

  const sortedRules = useMemo(() => [...pair.rules].sort((a, b) => a.index - b.index), [pair.rules]);

  const allFindings = useMemo<Finding[]>(() => [
    ...(pair.analysis?.findings ?? []),
    ...state.aiFindings,
  ], [pair.analysis?.findings, state.aiFindings]);

  async function handleAiAnalyze() {
    dispatch({ aiLoading: true, aiError: null });
    try {
      const result = await api.analyzeWithAi({
        source_zone_name: sourceZoneName,
        destination_zone_name: destZoneName,
        rules: pair.rules,
      });
      dispatch({ aiFindings: result.findings });
    } catch (err) {
      dispatch({ aiError: err instanceof Error ? err.message : "AI analysis failed" });
    } finally {
      dispatch({ aiLoading: false });
    }
  }

  function handleToggle(rule: Rule) {
    setConfirmAction({
      title: `${rule.enabled ? "Disable" : "Enable"} Rule`,
      message: `${rule.enabled ? "Disable" : "Enable"} "${rule.name}"? This change applies immediately to the controller.`,
      confirmLabel: rule.enabled ? "Disable" : "Enable",
      action: async () => {
        dispatch({ writeLoading: rule.id, writeError: null });
        try {
          await api.toggleRule(rule.id, !rule.enabled);
          onRuleUpdated();
        } catch (err) {
          dispatch({ writeError: err instanceof Error ? err.message : "Toggle failed" });
        } finally {
          dispatch({ writeLoading: null });
        }
      },
    });
  }

  function handleSwap(ruleA: Rule, ruleB: Rule, direction: "up" | "down") {
    const target = direction === "up" ? ruleB : ruleA;
    setConfirmAction({
      title: `Move Rule ${direction === "up" ? "Up" : "Down"}`,
      message: `Move "${target.name}" ${direction}? This changes rule evaluation order on the controller.`,
      confirmLabel: `Move ${direction}`,
      action: async () => {
        dispatch({ writeLoading: target.id, writeError: null });
        try {
          await api.swapRuleOrder(ruleA.id, ruleB.id);
          onRuleUpdated();
        } catch (err) {
          dispatch({ writeError: err instanceof Error ? err.message : "Reorder failed" });
        } finally {
          dispatch({ writeLoading: null });
        }
      },
    });
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-noc-border bg-white dark:bg-noc-input px-2.5 py-1.5 text-xs font-mono text-gray-900 dark:text-noc-text placeholder-gray-400 dark:placeholder-noc-text-dim focus:border-ub-blue focus:outline-none focus:ring-1 focus:ring-ub-blue/40 transition-colors";

  return (
    <>
    <div className="w-[400px] h-full border-l border-gray-200 dark:border-noc-border bg-white dark:bg-noc-surface flex flex-col overflow-hidden animate-slide-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-noc-border">
        <h2 className="text-sm font-display font-semibold text-gray-900 dark:text-noc-text truncate">
          {sourceZoneName} &rarr; {destZoneName}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 dark:text-noc-text-dim hover:text-gray-600 dark:hover:text-noc-text text-lg leading-none cursor-pointer transition-colors"
          aria-label="Close panel"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Analysis section */}
        {pair.analysis && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`px-2.5 py-1 rounded-md text-xs font-bold text-white ${gradeColor(pair.analysis.grade)}`}>
                {pair.analysis.grade}
              </div>
              <span className="text-xs font-mono text-gray-500 dark:text-noc-text-dim">
                {pair.analysis.score}/100
              </span>
            </div>
            {allFindings.length > 0 && (
              <FindingsList findings={allFindings} />
            )}
          </div>
        )}
        {state.aiError && (
          <div className="rounded-lg bg-red-50 dark:bg-status-danger-dim border border-red-200 dark:border-status-danger/20 p-2.5 text-xs text-red-700 dark:text-status-danger">
            {state.aiError}
          </div>
        )}
        {aiConfigured && (
          <button
            onClick={handleAiAnalyze}
            disabled={state.aiLoading}
            className="w-full rounded-lg bg-ub-purple px-3 py-1.5 text-xs font-semibold text-white hover:bg-ub-purple-light focus:outline-none focus:ring-2 focus:ring-ub-purple/40 focus:ring-offset-1 dark:focus:ring-offset-noc-surface disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            {state.aiLoading ? "Analyzing..." : "Analyze with AI"}
          </button>
        )}

        {/* Rule list */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">
            Rules ({sortedRules.length})
          </h3>
          {sortedRules.map((rule, idx) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              idx={idx}
              totalRules={sortedRules.length}
              isExpanded={expandedRuleId === rule.id}
              isMatchedRule={state.simResult?.matched_rule_id === rule.id}
              isWriteLoading={state.writeLoading === rule.id}
              writeDisabled={state.writeLoading !== null}
              sourceZoneName={sourceZoneName}
              destZoneName={destZoneName}
              sortedRules={sortedRules}
              onToggleExpand={() => setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)}
              onToggle={handleToggle}
              onSwap={handleSwap}
            />
          ))}
        </div>

        {state.writeError && (
          <div className="rounded-lg bg-red-50 dark:bg-status-danger-dim border border-red-200 dark:border-status-danger/20 p-2.5 text-xs text-red-700 dark:text-status-danger">
            {state.writeError}
          </div>
        )}

        {/* Packet simulation form */}
        <SimulationForm state={state} dispatch={dispatch} inputClass={inputClass} />

        {/* Simulation result */}
        <SimulationResult simResult={state.simResult} simError={state.simError} />
      </div>
    </div>
    <ConfirmDialog
      open={confirmAction !== null}
      title={confirmAction?.title ?? ""}
      message={confirmAction?.message ?? ""}
      confirmLabel={confirmAction?.confirmLabel}
      onConfirm={async () => {
        const action = confirmAction?.action;
        setConfirmAction(null);
        if (action) await action();
      }}
      onCancel={() => setConfirmAction(null)}
    />
    </>
  );
}
