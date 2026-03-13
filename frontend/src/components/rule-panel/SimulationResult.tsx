import type { SimulateResponse } from "../../api/types";
import { verdictColor } from "./utils";

export default function SimulationResult({ simResult, simError }: { simResult: SimulateResponse | null; simError: string | null }) {
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
