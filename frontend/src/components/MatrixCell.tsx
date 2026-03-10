interface MatrixCellProps {
  totalRules: number;
  grade: string | null;
  onClick: () => void;
  isSelfPair?: boolean;
}

function getCellColor(grade: string | null, totalRules: number): string {
  if (totalRules === 0 || grade === null) return "bg-gray-50 dark:bg-gray-800";
  if (grade === "A" || grade === "B") return "bg-green-100 dark:bg-green-900";
  if (grade === "C") return "bg-amber-100 dark:bg-amber-900";
  return "bg-red-100 dark:bg-red-900";
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
      onClick={onClick}
      className={`w-full h-full flex items-center justify-center text-xs font-medium rounded border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-blue-400 cursor-pointer transition-shadow ${color} ${isSelfPair ? "opacity-40" : ""}`}
    >
      {totalRules > 0 ? (
        <span className="text-gray-700 dark:text-gray-300">
          {totalRules} {grade}
        </span>
      ) : (
        <span className="text-gray-400 dark:text-gray-600">&mdash;</span>
      )}
    </button>
  );
}
