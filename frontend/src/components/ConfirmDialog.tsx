interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      data-testid="confirm-backdrop"
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white dark:bg-noc-surface border border-gray-200 dark:border-noc-border rounded-xl shadow-xl p-5 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-display font-semibold text-gray-900 dark:text-noc-text">
          {title}
        </h3>
        <p className="mt-2 text-xs text-gray-600 dark:text-noc-text-secondary">
          {message}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-noc-border text-gray-700 dark:text-noc-text-secondary hover:bg-gray-50 dark:hover:bg-noc-raised cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-ub-blue text-white hover:bg-ub-blue-light cursor-pointer transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
