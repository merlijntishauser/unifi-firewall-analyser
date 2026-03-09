interface MatrixCellProps {
  allowCount: number;
  blockCount: number;
  totalRules: number;
  onClick: () => void;
  isSelfPair?: boolean;
}

function getCellColor(allowCount: number, blockCount: number): string {
  if (allowCount === 0 && blockCount === 0) return "bg-gray-50 dark:bg-gray-800";
  if (allowCount > 0 && blockCount === 0) return "bg-green-100 dark:bg-green-900";
  if (blockCount > 0 && allowCount === 0) return "bg-red-100 dark:bg-red-900";
  return "bg-amber-100 dark:bg-amber-900";
}

export default function MatrixCell({
  allowCount,
  blockCount,
  totalRules,
  onClick,
  isSelfPair = false,
}: MatrixCellProps) {
  const color = getCellColor(allowCount, blockCount);

  return (
    <button
      onClick={onClick}
      className={`w-full h-full flex items-center justify-center text-xs font-medium rounded border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-blue-400 cursor-pointer transition-shadow ${color} ${isSelfPair ? "opacity-40" : ""}`}
    >
      {totalRules > 0 ? (
        <span className="text-gray-700 dark:text-gray-300">{totalRules}</span>
      ) : (
        <span className="text-gray-400 dark:text-gray-600">&mdash;</span>
      )}
    </button>
  );
}
