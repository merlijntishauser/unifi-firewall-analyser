import type { ColorMode } from "@xyflow/react";

interface ToolbarProps {
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  showDisabled: boolean;
  onShowDisabledChange: (show: boolean) => void;
  onRefresh: () => void;
  loading: boolean;
  onLogout: () => void;
  onOpenSettings: () => void;
}

export default function Toolbar({
  colorMode,
  onColorModeChange,
  showDisabled,
  onShowDisabledChange,
  onRefresh,
  loading,
  onLogout,
  onOpenSettings,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mr-auto">
        UniFi Firewall Analyser
      </h1>

      <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={showDisabled}
          onChange={(e) => onShowDisabledChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        Show disabled rules
      </label>

      <button
        onClick={() =>
          onColorModeChange(colorMode === "dark" ? "light" : "dark")
        }
        className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
      >
        {colorMode === "dark" ? "Light" : "Dark"}
      </button>

      <button
        onClick={onRefresh}
        disabled={loading}
        className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? "Refreshing..." : "Refresh"}
      </button>

      <button
        onClick={onOpenSettings}
        className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
      >
        Settings
      </button>

      <button
        onClick={onLogout}
        className="rounded border border-red-300 dark:border-red-700 px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer"
      >
        Disconnect
      </button>
    </div>
  );
}
