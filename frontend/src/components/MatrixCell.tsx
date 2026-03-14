import type { ActionLabel } from "../utils/matrixUtils";

interface MatrixCellProps {
  actionLabel: ActionLabel | null;
  userRuleCount: number;
  predefinedRuleCount: number;
  grade: string | null;
  onClick: () => void;
  isSelfPair: boolean;
}

function getActionColor(actionLabel: ActionLabel | null): string {
  switch (actionLabel) {
    case "Allow All":
      return "bg-green-50 dark:bg-status-success/10 border-green-200 dark:border-status-success/25";
    case "Allow Return":
      return "bg-blue-50 dark:bg-ub-blue/10 border-blue-200 dark:border-ub-blue/25";
    case "Block All":
      return "bg-red-50 dark:bg-status-danger/10 border-red-200 dark:border-status-danger/25";
    case "Mixed":
      return "bg-amber-50 dark:bg-status-warning/10 border-amber-200 dark:border-status-warning/25";
    default:
      return "bg-gray-50 dark:bg-noc-raised/50 border-gray-200 dark:border-noc-border";
  }
}

function getGradeDotColor(grade: string | null): string | null {
  if (grade === "A" || grade === "B") return "bg-green-500 dark:bg-status-success";
  if (grade === "C") return "bg-amber-500 dark:bg-status-warning";
  if (grade === "D" || grade === "F") return "bg-red-500 dark:bg-status-danger";
  return null;
}

function buildTooltip(userRuleCount: number, predefinedRuleCount: number): string {
  const parts: string[] = [];
  if (userRuleCount > 0) parts.push(`${userRuleCount} user rule${userRuleCount !== 1 ? "s" : ""}`);
  if (predefinedRuleCount > 0) parts.push(`${predefinedRuleCount} predefined rule${predefinedRuleCount !== 1 ? "s" : ""}`);
  return parts.join(", ");
}

export default function MatrixCell({
  actionLabel,
  userRuleCount,
  predefinedRuleCount,
  grade,
  onClick,
  isSelfPair,
}: MatrixCellProps) {
  if (isSelfPair) {
    return (
      <div
        data-testid="matrix-cell"
        className="w-full h-full flex items-center justify-center text-xs rounded-lg bg-gray-100 dark:bg-noc-raised/30 text-gray-300 dark:text-noc-text-dim"
      >
        &mdash;
      </div>
    );
  }

  const color = getActionColor(actionLabel);
  const dotColor = getGradeDotColor(grade);
  const tooltip = buildTooltip(userRuleCount, predefinedRuleCount);

  return (
    <button
      data-testid="matrix-cell"
      onClick={onClick}
      className={`group relative w-full h-full flex items-center justify-center text-xs font-medium rounded-lg border hover:ring-2 hover:ring-ub-blue/40 cursor-pointer transition-all ${color}`}
    >
      {actionLabel ? (
        <span className="flex items-center gap-1">
          <span className="text-gray-700 dark:text-noc-text">{actionLabel}</span>
          {userRuleCount > 0 && (
            <span className="text-ub-blue font-semibold">({userRuleCount})</span>
          )}
        </span>
      ) : (
        <span className="text-gray-300 dark:text-noc-text-dim">&mdash;</span>
      )}
      {dotColor && (
        <span
          data-testid="grade-dot"
          className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${dotColor}`}
        />
      )}
      {tooltip && (
        <span
          data-testid="cell-tooltip"
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-noc-raised text-[11px] text-white dark:text-noc-text whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 border border-transparent dark:border-noc-border shadow-lg"
        >
          {tooltip}
        </span>
      )}
    </button>
  );
}
