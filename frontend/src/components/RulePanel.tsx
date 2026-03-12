import { useMemo, useReducer, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";
import type { ZonePair, Rule, Finding, SimulateResponse } from "../api/types";

interface RulePanelProps {
  pair: ZonePair;
  sourceZoneName: string;
  destZoneName: string;
  aiConfigured: boolean;
  onClose: () => void;
}

interface RulePanelState {
  srcIp: string;
  dstIp: string;
  protocol: string;
  port: string;
  simLoading: boolean;
  simResult: SimulateResponse | null;
  simError: string | null;
  aiLoading: boolean;
  aiError: string | null;
  aiFindings: Finding[];
}

const initialState: RulePanelState = {
  srcIp: "",
  dstIp: "",
  protocol: "TCP",
  port: "",
  simLoading: false,
  simResult: null,
  simError: null,
  aiLoading: false,
  aiError: null,
  aiFindings: [],
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

const DT_CLASS = "font-semibold text-gray-700 dark:text-noc-text";

interface DetailRow {
  label: string;
  value: string;
  mono?: boolean;
  members?: string[];
}

function buildDetailRows(rule: Rule, sourceZoneName: string, destZoneName: string): DetailRow[] {
  const rows: DetailRow[] = [
    { label: "Action", value: rule.action, mono: true },
    { label: "Protocol", value: rule.protocol || "any", mono: true },
    { label: "Source", value: sourceZoneName },
    { label: "Dst Ports", value: rule.port_ranges.length > 0 ? rule.port_ranges.join(", ") : "any", mono: true },
    { label: "Dst IPs", value: rule.ip_ranges.length > 0 ? rule.ip_ranges.join(", ") : "any", mono: true },
    { label: "Destination", value: destZoneName },
  ];

  const optional: [string, string, string[]?][] = [
    ["Src Ports", rule.source_port_ranges.join(", ")],
    ["Src IPs", rule.source_ip_ranges.join(", ")],
    ["Src MACs", rule.source_mac_addresses.join(", ")],
    ["Dst MACs", rule.destination_mac_addresses.join(", ")],
    ["Dst Port Group", rule.destination_port_group, rule.destination_port_group_members],
    ["Src Port Group", rule.source_port_group, rule.source_port_group_members],
    ["Dst Addr Group", rule.destination_address_group, rule.destination_address_group_members],
    ["Src Addr Group", rule.source_address_group, rule.source_address_group_members],
    ["Conn State", rule.connection_state_type],
    ["Schedule", rule.schedule],
    ["IPSec", rule.match_ip_sec],
  ];
  for (const [label, value, members] of optional) {
    if (value) rows.push({ label, value, mono: !members, members });
  }

  rows.push({ label: "Status", value: rule.enabled ? "Enabled" : "Disabled" });
  rows.push({ label: "Logging", value: rule.connection_logging ? "Enabled" : "Disabled" });
  if (rule.predefined) rows.push({ label: "Type", value: "Built-in (predefined)" });
  rows.push({ label: "Index", value: String(rule.index), mono: true });
  return rows;
}

function RuleDetails({ rule, sourceZoneName, destZoneName }: { rule: Rule; sourceZoneName: string; destZoneName: string }) {
  const rows = buildDetailRows(rule, sourceZoneName, destZoneName);
  return (
    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-noc-border text-gray-600 dark:text-noc-text-secondary">
      {rule.description && (
        <p className="mb-2 italic">{rule.description}</p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map((row) => (
          <DetailRowView key={row.label} row={row} />
        ))}
      </dl>
      <div className="mt-2 font-mono text-[10px] text-gray-400 dark:text-noc-text-dim">
        ID: {rule.id}
      </div>
    </div>
  );
}

function DetailRowView({ row }: { row: DetailRow }) {
  return (
    <>
      <dt className={DT_CLASS}>{row.label}</dt>
      <dd className={row.mono ? "font-mono" : undefined}>
        {row.members ? (
          <>
            <span>{row.value}</span>
            {row.members.length > 0 && (
              <span className="ml-1 font-mono text-gray-400 dark:text-noc-text-dim">
                ({row.members.join(", ")})
              </span>
            )}
          </>
        ) : (
          row.value
        )}
      </dd>
    </>
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
}: RulePanelProps) {
  const [state, dispatch] = useReducer(rulePanelReducer, initialState);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

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

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-noc-border bg-white dark:bg-noc-input px-2.5 py-1.5 text-xs font-mono text-gray-900 dark:text-noc-text placeholder-gray-400 dark:placeholder-noc-text-dim focus:border-ub-blue focus:outline-none focus:ring-1 focus:ring-ub-blue/40 transition-colors";

  return (
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
              <div className="space-y-1.5">
                <h3 className="text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">
                  Findings ({allFindings.length})
                </h3>
                {allFindings.map((finding, idx) => (
                  <div key={finding.id ?? idx} className="rounded-lg border border-gray-200 dark:border-noc-border p-2.5 text-xs bg-gray-50 dark:bg-noc-raised/50">
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
                  </div>
                ))}
              </div>
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
          {sortedRules.map((rule, idx) => {
            const isExpanded = expandedRuleId === rule.id;
            return (
              <div
                key={rule.id}
                className={`rounded-lg border p-2.5 text-xs cursor-pointer transition-colors ${actionColor(rule.action, rule.enabled)} ${
                  state.simResult?.matched_rule_id === rule.id
                    ? "ring-2 ring-ub-blue"
                    : ""
                }`}
                onClick={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedRuleId(isExpanded ? null : rule.id);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium text-gray-900 dark:text-noc-text truncate">
                    {idx + 1}. {rule.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
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
          })}
        </div>

        {/* Packet simulation form */}
        <SimulationForm state={state} dispatch={dispatch} inputClass={inputClass} />

        {/* Simulation result */}
        <SimulationResult simResult={state.simResult} simError={state.simError} />
      </div>
    </div>
  );
}
