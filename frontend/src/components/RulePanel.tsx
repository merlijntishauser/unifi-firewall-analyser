import { useMemo, useReducer, useState } from "react";
import type { FormEvent } from "react";
import type { ZonePair, Rule, Finding } from "../api/types";
import { useSimulate, useAnalyzeWithAi, useToggleRule, useSwapRuleOrder } from "../hooks/queries";
import ConfirmDialog from "./ConfirmDialog";
import {
  RuleCard, SimulationForm, SimulationResult, FindingsList, AiAnalysisStatus,
  gradeColor, initialFormState, formReducer, buildSimulateRequest, deriveAiError, deriveMutationError,
} from "./rule-panel";

interface RulePanelProps {
  pair: ZonePair;
  sourceZoneName: string;
  destZoneName: string;
  aiConfigured: boolean;
  onClose: () => void;
  onRuleUpdated: () => void;
}

function AnalysisSection({ analysis, allFindings }: { analysis: ZonePair["analysis"]; allFindings: Finding[] }) {
  if (!analysis) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={`px-2.5 py-1 rounded-md text-xs font-bold text-white ${gradeColor(analysis.grade)}`}>
          {analysis.grade}
        </div>
        <span className="text-xs font-mono text-gray-500 dark:text-noc-text-dim">
          {analysis.score}/100
        </span>
      </div>
      {allFindings.length > 0 && (
        <FindingsList findings={allFindings} />
      )}
    </div>
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
  const [form, formDispatch] = useReducer(formReducer, initialFormState);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    action: () => Promise<void>;
  } | null>(null);
  const [writeLoadingId, setWriteLoadingId] = useState<string | null>(null);

  const simulateMutation = useSimulate();
  const analyzeMutation = useAnalyzeWithAi();
  const toggleMutation = useToggleRule();
  const swapMutation = useSwapRuleOrder();

  const sortedRules = useMemo(() => [...pair.rules].sort((a, b) => a.index - b.index), [pair.rules]);

  const aiData = analyzeMutation.data;
  const aiError = deriveAiError(analyzeMutation.error as Error | null, aiData);
  const aiFindings = useMemo(() => aiData && aiData.status !== "error" ? aiData.findings : [], [aiData]);
  const aiCached = aiData?.cached ?? false;
  const aiCompleted = analyzeMutation.isSuccess && aiData?.status !== "error";

  const allFindings = useMemo<Finding[]>(() => [
    ...(pair.analysis?.findings ?? []),
    ...aiFindings,
  ], [pair.analysis?.findings, aiFindings]);

  const writeError = deriveMutationError(toggleMutation.error, "Toggle failed")
    ?? deriveMutationError(swapMutation.error, "Reorder failed");

  function handleSimulate(e: FormEvent) {
    e.preventDefault();
    simulateMutation.mutate(buildSimulateRequest(form));
  }

  function handleAiAnalyze() {
    analyzeMutation.mutate({
      source_zone_name: sourceZoneName,
      destination_zone_name: destZoneName,
      rules: pair.rules,
    });
  }

  function handleToggle(rule: Rule) {
    const verb = rule.enabled ? "Disable" : "Enable";
    setConfirmAction({
      title: `${verb} Rule`,
      message: `${verb} "${rule.name}"? This change applies immediately to the controller.`,
      confirmLabel: verb,
      action: async () => {
        setWriteLoadingId(rule.id);
        try {
          await toggleMutation.mutateAsync({ ruleId: rule.id, enabled: !rule.enabled });
          onRuleUpdated();
        } catch { /* captured by toggleMutation.error */ } finally {
          setWriteLoadingId(null);
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
        setWriteLoadingId(target.id);
        try {
          await swapMutation.mutateAsync({ policyIdA: ruleA.id, policyIdB: ruleB.id });
          onRuleUpdated();
        } catch { /* captured by swapMutation.error */ } finally {
          setWriteLoadingId(null);
        }
      },
    });
  }

  const simError = deriveMutationError(simulateMutation.error, "Simulation failed");

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
        <AnalysisSection analysis={pair.analysis} allFindings={allFindings} />
        <AiAnalysisStatus
          aiError={aiError}
          aiCompleted={aiCompleted}
          aiCached={aiCached}
          aiFindings={aiFindings}
          aiLoading={analyzeMutation.isPending}
          aiConfigured={aiConfigured}
          onAnalyze={handleAiAnalyze}
        />

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
              isMatchedRule={simulateMutation.data?.matched_rule_id === rule.id}
              isWriteLoading={writeLoadingId === rule.id}
              writeDisabled={writeLoadingId !== null}
              sourceZoneName={sourceZoneName}
              destZoneName={destZoneName}
              sortedRules={sortedRules}
              onToggleExpand={() => setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)}
              onToggle={handleToggle}
              onSwap={handleSwap}
            />
          ))}
        </div>

        {writeError && (
          <div className="rounded-lg bg-red-50 dark:bg-status-danger-dim border border-red-200 dark:border-status-danger/20 p-2.5 text-xs text-red-700 dark:text-status-danger">
            {writeError}
          </div>
        )}

        {/* Packet simulation form */}
        <SimulationForm form={form} onFormChange={formDispatch} onSubmit={handleSimulate} isLoading={simulateMutation.isPending} inputClass={inputClass} />

        {/* Simulation result */}
        <SimulationResult simResult={simulateMutation.data ?? null} simError={simError} />
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
