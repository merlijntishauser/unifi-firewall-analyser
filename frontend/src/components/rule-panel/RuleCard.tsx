import type { Rule } from "../../api/types";
import RuleDetails from "./RuleDetails";
import { actionColor, actionBadge } from "./utils";

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

export interface RuleCardProps {
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

export default function RuleCard({
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
