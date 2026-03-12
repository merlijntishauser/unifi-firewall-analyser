interface MatrixCellProps {
  totalRules: number;
  grade: string | null;
  onClick: () => void;
  isSelfPair?: boolean;
}

function getCellColor(grade: string | null, totalRules: number): string {
  if (totalRules === 0 || grade === null)
    return "bg-gray-50 dark:bg-noc-raised/50 border-gray-200 dark:border-noc-border";
  if (grade === "A" || grade === "B")
    return "bg-green-50 dark:bg-status-success/8 border-green-200 dark:border-status-success/25";
  if (grade === "C")
    return "bg-amber-50 dark:bg-status-warning/8 border-amber-200 dark:border-status-warning/25";
  return "bg-red-50 dark:bg-status-danger/8 border-red-200 dark:border-status-danger/25";
}

function getGradeTextColor(grade: string | null): string {
  if (grade === "A" || grade === "B") return "text-green-700 dark:text-status-success";
  if (grade === "C") return "text-amber-700 dark:text-status-warning";
  if (grade === "D" || grade === "F") return "text-red-700 dark:text-status-danger";
  return "text-gray-500 dark:text-noc-text-dim";
}

export default function MatrixCell({
  totalRules,
  grade,
  onClick,
  isSelfPair = false,
}: MatrixCellProps) {
  const color = getCellColor(grade, totalRules);

  return (
    <button
      data-testid="matrix-cell"
      onClick={onClick}
      className={`w-full h-full flex flex-col items-center justify-center text-xs font-medium rounded-lg border hover:ring-2 hover:ring-ub-blue/40 cursor-pointer transition-all ${color} ${isSelfPair ? "opacity-30" : ""}`}
    >
      {totalRules > 0 ? (
        <>
          <span className="text-gray-600 dark:text-noc-text-secondary font-mono text-[11px]">
            {totalRules}
          </span>
          <span className={`text-[10px] font-bold ${getGradeTextColor(grade)}`}>
            {grade}
          </span>
        </>
      ) : (
        <span className="text-gray-300 dark:text-noc-text-dim">&mdash;</span>
      )}
    </button>
  );
}
