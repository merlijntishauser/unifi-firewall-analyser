import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";
import type { ZonePair, Rule, SimulateResponse } from "../api/types";

interface RulePanelProps {
  pair: ZonePair;
  sourceZoneName: string;
  destZoneName: string;
  onClose: () => void;
}

function gradeColor(grade: string): string {
  if (grade === "A" || grade === "B") return "bg-green-600";
  if (grade === "C") return "bg-amber-500";
  return "bg-red-600";
}

function severityBadge(severity: string): string {
  switch (severity) {
    case "high":
      return "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300";
    case "medium":
      return "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300";
    case "low":
      return "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300";
    default:
      return "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
  }
}

function actionColor(action: Rule["action"], enabled: boolean): string {
  if (!enabled) return "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600";
  switch (action) {
    case "ALLOW":
      return "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700";
    case "BLOCK":
    case "REJECT":
      return "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700";
  }
}

function actionBadge(action: Rule["action"]): string {
  switch (action) {
    case "ALLOW":
      return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
    case "BLOCK":
      return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
    case "REJECT":
      return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
  }
}

function verdictColor(verdict: string | null): string {
  switch (verdict) {
    case "ALLOW":
      return "bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200";
    case "BLOCK":
    case "REJECT":
      return "bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200";
    default:
      return "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300";
  }
}

export default function RulePanel({
  pair,
  sourceZoneName,
  destZoneName,
  onClose,
}: RulePanelProps) {
  const [srcIp, setSrcIp] = useState("");
  const [dstIp, setDstIp] = useState("");
  const [protocol, setProtocol] = useState("TCP");
  const [port, setPort] = useState("");
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<SimulateResponse | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  const sortedRules = [...pair.rules].sort((a, b) => a.index - b.index);

  async function handleSimulate(e: FormEvent) {
    e.preventDefault();
    setSimLoading(true);
    setSimError(null);
    setSimResult(null);
    try {
      const result = await api.simulate({
        src_ip: srcIp,
        dst_ip: dstIp,
        protocol: protocol === "Any" ? "all" : protocol.toLowerCase(),
        port: port ? Number(port) : null,
      });
      setSimResult(result);
    } catch (err) {
      setSimError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimLoading(false);
    }
  }

  return (
    <div className="w-[400px] h-full border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
          {sourceZoneName} &rarr; {destZoneName}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none cursor-pointer"
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
              <div className={`px-2 py-1 rounded text-xs font-bold text-white ${gradeColor(pair.analysis.grade)}`}>
                {pair.analysis.grade}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {pair.analysis.score}/100
              </span>
            </div>
            {pair.analysis.findings.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Findings ({pair.analysis.findings.length})
                </h3>
                {pair.analysis.findings.map((finding, idx) => (
                  <div key={finding.id ?? idx} className="rounded border border-gray-200 dark:border-gray-700 p-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadge(finding.severity)}`}>
                        {finding.severity}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{finding.title}</span>
                    </div>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">{finding.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rule list */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Rules ({sortedRules.length})
          </h3>
          {sortedRules.map((rule) => (
            <div
              key={rule.id}
              className={`rounded border p-2 text-xs ${actionColor(rule.action, rule.enabled)} ${
                simResult?.matched_rule_id === rule.id
                  ? "ring-2 ring-blue-500"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {rule.index}. {rule.name}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {rule.predefined && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
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
                <div className="mt-1 text-gray-500 dark:text-gray-400">
                  {rule.protocol && <span>{rule.protocol}</span>}
                  {rule.port_ranges.length > 0 && (
                    <span className="ml-1">
                      port {rule.port_ranges.join(", ")}
                    </span>
                  )}
                </div>
              )}
              {!rule.enabled && (
                <div className="mt-1 text-gray-400 dark:text-gray-500 italic">
                  disabled
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Packet simulation form */}
        <form onSubmit={handleSimulate} className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Packet Simulation
          </h3>
          <input
            type="text"
            placeholder="Source IP"
            value={srcIp}
            onChange={(e) => setSrcIp(e.target.value)}
            required
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Destination IP"
            value={dstIp}
            onChange={(e) => setDstIp(e.target.value)}
            required
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="ICMP">ICMP</option>
              <option value="Any">Any</option>
            </select>
            <input
              type="number"
              placeholder="Port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              min={1}
              max={65535}
              className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={simLoading}
            className="w-full rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {simLoading ? "Simulating..." : "Simulate"}
          </button>
        </form>

        {/* Simulation error */}
        {simError && (
          <div className="rounded bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-2 text-xs text-red-700 dark:text-red-300">
            {simError}
          </div>
        )}

        {/* Simulation result */}
        {simResult && (
          <div className="space-y-2">
            <div
              className={`rounded border p-3 text-center font-semibold text-sm ${verdictColor(simResult.verdict)}`}
            >
              {simResult.verdict ?? "NO MATCH"}
              {simResult.default_policy_used && (
                <div className="text-xs font-normal mt-1 opacity-75">
                  (default policy)
                </div>
              )}
            </div>

            {simResult.matched_rule_name && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Matched:{" "}
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {simResult.matched_rule_name}
                </span>
              </div>
            )}

            {simResult.evaluations.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Evaluation Chain
                </h4>
                {simResult.evaluations.map((ev) => (
                  <div
                    key={ev.rule_id}
                    className={`text-xs px-2 py-1 rounded border ${
                      ev.matched
                        ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950"
                        : ev.skipped_disabled
                          ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-50"
                          : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                        {ev.rule_name}
                      </span>
                      <span
                        className={`shrink-0 ml-1 ${ev.matched ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-400 dark:text-gray-500"}`}
                      >
                        {ev.matched ? "MATCH" : "skip"}
                      </span>
                    </div>
                    <div className="text-gray-400 dark:text-gray-500 mt-0.5">
                      {ev.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
