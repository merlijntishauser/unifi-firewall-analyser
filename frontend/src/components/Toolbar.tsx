import type { ColorMode } from "@xyflow/react";

interface ConnectionInfo {
  url: string;
  username: string;
  source: "env" | "runtime" | "none";
}

interface AiInfo {
  configured: boolean;
  provider: string;
  model: string;
}

interface ToolbarProps {
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  hasHiddenZones: boolean;
  hasDisabledRules: boolean;
  onRefresh: () => void;
  loading: boolean;
  onLogout: () => void;
  onOpenSettings: () => void;
  connectionInfo: ConnectionInfo | null;
  aiInfo: AiInfo;
}

function StatusBadge({ active, label, tooltip }: { active: boolean; label: string; tooltip: string }) {
  return (
    <div className="relative group">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium select-none ${
        active
          ? "bg-emerald-50 dark:bg-status-success-dim text-emerald-700 dark:text-status-success"
          : "bg-gray-100 dark:bg-noc-raised text-gray-500 dark:text-noc-text-dim"
      }`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${
          active ? "bg-emerald-500 dark:bg-status-success" : "bg-gray-400 dark:bg-noc-text-dim"
        }`} />
        {label}
      </div>
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-noc-raised text-[11px] text-white dark:text-noc-text whitespace-pre opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 border border-transparent dark:border-noc-border shadow-lg">
        {tooltip}
      </div>
    </div>
  );
}

export default function Toolbar({
  colorMode,
  onColorModeChange,
  showHidden,
  onShowHiddenChange,
  hasHiddenZones,
  hasDisabledRules,
  onRefresh,
  loading,
  onLogout,
  onOpenSettings,
  connectionInfo,
  aiInfo,
}: ToolbarProps) {
  const btnClass =
    "rounded-lg border border-gray-300 dark:border-noc-border px-3 py-1.5 text-sm text-gray-600 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised hover:text-gray-900 dark:hover:text-noc-text hover:border-gray-400 dark:hover:border-noc-border-hover cursor-pointer transition-all";

  const connectionTooltip = connectionInfo
    ? `Connected to: ${connectionInfo.url}\nAs: ${connectionInfo.username}\nConfig from: ${connectionInfo.source}`
    : "Not connected";

  const aiTooltip = aiInfo.configured
    ? `AI LLM: ${aiInfo.provider}\nModel: ${aiInfo.model}`
    : "Not configured";

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-200 dark:border-noc-border bg-white dark:bg-noc-surface">
      <h1 className="text-base font-display font-semibold text-gray-900 dark:text-noc-text tracking-tight">
        UniFi Firewall Analyser
      </h1>

      <StatusBadge active={connectionInfo !== null} label="Controller" tooltip={connectionTooltip} />
      <StatusBadge active={aiInfo.configured} label="AI" tooltip={aiTooltip} />

      <div className="mr-auto" />

      {(hasHiddenZones || hasDisabledRules) && (
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-noc-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => onShowHiddenChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-noc-border text-ub-blue focus:ring-ub-blue bg-white dark:bg-noc-input accent-ub-blue"
          />
          {hasHiddenZones && hasDisabledRules
            ? "Show filtered zones and disabled rules"
            : hasHiddenZones
              ? "Show filtered zones"
              : "Show disabled rules"}
        </label>
      )}

      <button
        onClick={() =>
          onColorModeChange(colorMode === "dark" ? "light" : "dark")
        }
        className={btnClass}
      >
        {colorMode === "dark" ? "Light" : "Dark"}
      </button>

      <button
        onClick={onRefresh}
        disabled={loading}
        className={`${btnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {loading ? "Refreshing..." : "Refresh"}
      </button>

      <button
        onClick={onOpenSettings}
        className={btnClass}
      >
        Settings
      </button>

      <button
        onClick={onLogout}
        className="rounded-lg border border-red-300 dark:border-status-danger/30 px-3 py-1.5 text-sm text-red-600 dark:text-status-danger hover:bg-red-50 dark:hover:bg-status-danger-dim cursor-pointer transition-all"
      >
        Disconnect
      </button>
    </div>
  );
}
