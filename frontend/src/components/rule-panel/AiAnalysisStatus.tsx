import type { Finding } from "../../api/types";

export default function AiAnalysisStatus({
  aiError,
  aiCompleted,
  aiCached,
  aiFindings,
  aiLoading,
  aiConfigured,
  onAnalyze,
}: {
  aiError: string | null;
  aiCompleted: boolean;
  aiCached: boolean;
  aiFindings: Finding[];
  aiLoading: boolean;
  aiConfigured: boolean;
  onAnalyze: () => void;
}) {
  return (
    <>
      {aiError && (
        <div className="rounded-lg bg-red-50 dark:bg-status-danger-dim border border-red-200 dark:border-status-danger/20 p-2.5 text-xs text-red-700 dark:text-status-danger">
          AI analysis failed: {aiError}
        </div>
      )}
      {aiCompleted && aiFindings.length === 0 && (
        <div className="rounded-lg bg-green-50 dark:bg-status-success/10 border border-green-200 dark:border-status-success/20 p-2.5 text-xs text-green-700 dark:text-status-success">
          AI analysis completed -- no additional findings.
          {aiCached && <span className="ml-1 opacity-70">(cached)</span>}
        </div>
      )}
      {aiCached && aiFindings.length > 0 && (
        <div className="text-[10px] text-gray-400 dark:text-noc-text-dim">
          AI findings from cache
        </div>
      )}
      {aiConfigured && (
        <button
          onClick={onAnalyze}
          disabled={aiLoading}
          className="w-full rounded-lg bg-ub-purple px-3 py-1.5 text-xs font-semibold text-white hover:bg-ub-purple-light focus:outline-none focus:ring-2 focus:ring-ub-purple/40 focus:ring-offset-1 dark:focus:ring-offset-noc-surface disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          {aiLoading ? "Analyzing..." : "Analyze with AI"}
        </button>
      )}
    </>
  );
}
