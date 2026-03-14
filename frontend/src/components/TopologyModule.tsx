import { useCallback, useMemo, useState } from "react";
import type { ZonePair } from "../api/types";
import { useAppContext } from "../hooks/useAppContext";
import { useTopologySvg, useTopologyThemes } from "../hooks/queries";
import { downloadSvg, downloadPng } from "../utils/export";
import SvgViewer from "./SvgViewer";
import ZoneGraph from "./ZoneGraph";
import RulePanel from "./RulePanel";

interface SelectedPairKey {
  sourceZoneId: string;
  destZoneId: string;
}

const THEME_DARK_MAP: Record<string, string> = {
  unifi: "unifi-dark",
  minimal: "minimal-dark",
  classic: "classic-dark",
  "unifi-dark": "unifi",
  "minimal-dark": "minimal",
  "classic-dark": "classic",
};

function resolveTheme(baseTheme: string, colorMode: string): string {
  if (colorMode === "dark" && !baseTheme.endsWith("-dark")) {
    return THEME_DARK_MAP[baseTheme] ?? baseTheme;
  }
  if (colorMode === "light" && baseTheme.endsWith("-dark")) {
    return THEME_DARK_MAP[baseTheme] ?? baseTheme;
  }
  return baseTheme;
}

function readStorage(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export default function TopologyModule() {
  const ctx = useAppContext();
  const { zones, filteredZonePairs, colorMode, hiddenZoneIds, showHidden, onRefresh, dataLoading, zonePairs, aiConfigured } = ctx;
  const authed = ctx.connectionInfo !== null;

  const [subView, setSubView] = useState<"diagram" | "interactive">(() =>
    readStorage("topologySubView", "diagram") as "diagram" | "interactive",
  );
  const [baseTheme, setBaseTheme] = useState(() => readStorage("topologyTheme", "unifi"));
  const [projection, setProjection] = useState<"orthogonal" | "isometric">(() =>
    readStorage("topologyProjection", "orthogonal") as "orthogonal" | "isometric",
  );
  const [selectedPairKey, setSelectedPairKey] = useState<SelectedPairKey | null>(null);

  const theme = resolveTheme(baseTheme, colorMode);
  const svgQuery = useTopologySvg(theme, projection, authed && subView === "diagram");
  const themesQuery = useTopologyThemes(authed);

  const themes = useMemo(() => themesQuery.data ?? [], [themesQuery.data]);

  const handleSubViewChange = useCallback((view: "diagram" | "interactive") => {
    setSubView(view);
    try { localStorage.setItem("topologySubView", view); } catch { /* noop */ }
  }, []);

  const handleThemeChange = useCallback((id: string) => {
    const base = id.endsWith("-dark") ? THEME_DARK_MAP[id] ?? id : id;
    setBaseTheme(base);
    try { localStorage.setItem("topologyTheme", base); } catch { /* noop */ }
  }, []);

  const handleProjectionChange = useCallback((p: "orthogonal" | "isometric") => {
    setProjection(p);
    try { localStorage.setItem("topologyProjection", p); } catch { /* noop */ }
  }, []);

  const handleEdgeSelect = useCallback((pair: ZonePair) => {
    setSelectedPairKey({ sourceZoneId: pair.source_zone_id, destZoneId: pair.destination_zone_id });
  }, []);

  const selectedPair = useMemo(() => {
    if (!selectedPairKey) return null;
    return zonePairs.find(
      (zp) => zp.source_zone_id === selectedPairKey.sourceZoneId && zp.destination_zone_id === selectedPairKey.destZoneId,
    ) ?? null;
  }, [zonePairs, selectedPairKey]);

  const getZoneName = useMemo(() => {
    const map = new Map(zones.map((z) => [z.id, z.name]));
    return (id: string) => map.get(id) ?? "Unknown";
  }, [zones]);

  const btnClass =
    "rounded-lg border border-gray-300 dark:border-noc-border px-3 py-1.5 text-sm text-gray-600 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised hover:text-gray-900 dark:hover:text-noc-text hover:border-gray-400 dark:hover:border-noc-border-hover cursor-pointer transition-all";
  const activeBtnClass =
    "rounded-lg border border-ub-blue px-3 py-1.5 text-sm text-ub-blue bg-blue-50 dark:bg-ub-blue-dim cursor-pointer transition-all";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-noc-border bg-white dark:bg-noc-surface shrink-0">
        <div className="flex rounded-lg border border-gray-300 dark:border-noc-border overflow-hidden">
          <button
            onClick={() => handleSubViewChange("diagram")}
            className={`px-3 py-1.5 text-sm transition-colors ${subView === "diagram" ? "bg-blue-50 dark:bg-ub-blue-dim text-ub-blue font-medium" : "text-gray-600 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised"}`}
          >
            Diagram
          </button>
          <button
            onClick={() => handleSubViewChange("interactive")}
            className={`px-3 py-1.5 text-sm border-l border-gray-300 dark:border-noc-border transition-colors ${subView === "interactive" ? "bg-blue-50 dark:bg-ub-blue-dim text-ub-blue font-medium" : "text-gray-600 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised"}`}
          >
            Interactive
          </button>
        </div>

        {subView === "diagram" && (
          <>
            <select
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-noc-border bg-white dark:bg-noc-input px-3 py-1.5 text-sm text-gray-600 dark:text-noc-text-secondary cursor-pointer"
              aria-label="Theme"
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <button
              onClick={() => handleProjectionChange(projection === "orthogonal" ? "isometric" : "orthogonal")}
              className={projection === "isometric" ? activeBtnClass : btnClass}
            >
              Isometric
            </button>

            {svgQuery.data && (
              <>
                <button onClick={() => downloadSvg(svgQuery.data.svg)} className={btnClass}>Export SVG</button>
                <button onClick={() => downloadPng(svgQuery.data.svg)} className={btnClass}>Export PNG</button>
              </>
            )}
          </>
        )}

        {subView === "interactive" && (
          <>
            <div className="ml-auto" />
            <button
              onClick={onRefresh}
              disabled={dataLoading}
              className={`${btnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {dataLoading ? "Refreshing..." : "Refresh"}
            </button>
          </>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {subView === "diagram" ? (
          svgQuery.isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-noc-border border-t-ub-blue animate-spin" />
              <p className="text-sm text-gray-500 dark:text-noc-text-secondary font-body">
                Rendering topology...
              </p>
            </div>
          ) : svgQuery.error ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <p className="text-sm text-status-danger">
                {svgQuery.error instanceof Error ? svgQuery.error.message : "Failed to render topology"}
              </p>
            </div>
          ) : svgQuery.data ? (
            <SvgViewer svgContent={svgQuery.data.svg} />
          ) : null
        ) : (
          <>
            <div className="flex-1">
              <ZoneGraph
                zones={zones}
                zonePairs={filteredZonePairs}
                colorMode={colorMode}
                onEdgeSelect={handleEdgeSelect}
                hiddenZoneIds={hiddenZoneIds}
                showHidden={showHidden}
              />
            </div>
            {selectedPair && (
              <RulePanel
                key={`${selectedPair.source_zone_id}-${selectedPair.destination_zone_id}`}
                pair={selectedPair}
                sourceZoneName={getZoneName(selectedPair.source_zone_id)}
                destZoneName={getZoneName(selectedPair.destination_zone_id)}
                aiConfigured={aiConfigured}
                onClose={() => setSelectedPairKey(null)}
                onRuleUpdated={onRefresh}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
