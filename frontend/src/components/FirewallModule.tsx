import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ZonePair } from "../api/types";
import { useAppContext } from "../hooks/useAppContext";
import MatrixSidebar from "./MatrixSidebar";
import ZoneGraph from "./ZoneGraph";
import ZoneMatrix from "./ZoneMatrix";
import RulePanel from "./RulePanel";

interface SelectedPairKey {
  sourceZoneId: string;
  destZoneId: string;
}

function formatError(error: Error | null): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

export default function FirewallModule() {
  const ctx = useAppContext();
  const {
    zones, filteredZonePairs, visibleZones, colorMode, hiddenZoneIds,
    showHidden, onShowHiddenChange, onToggleZone, aiConfigured, onRefresh, dataLoading, dataError,
    zonePairs, hasHiddenZones, hasDisabledRules,
  } = ctx;

  const deepLinkPair = useRef(new URLSearchParams(window.location.search).get("pair"));
  const [selectedPairKey, setSelectedPairKey] = useState<SelectedPairKey | null>(null);
  const [focusZoneIds, setFocusZoneIds] = useState<string[] | null>(null);

  // Deep-link: ?pair=SourceName->DestName -- resolve once zone data is available
  useEffect(() => {
    if (!deepLinkPair.current || zones.length === 0 || zonePairs.length === 0) return;
    const param = deepLinkPair.current;
    deepLinkPair.current = null;
    const [srcName, dstName] = param.split("->");
    if (!srcName || !dstName) return;
    const srcZone = zones.find((z) => z.name === srcName);
    const dstZone = zones.find((z) => z.name === dstName);
    if (!srcZone || !dstZone) return;
    setFocusZoneIds([srcZone.id, dstZone.id]);
    setSelectedPairKey({ sourceZoneId: srcZone.id, destZoneId: dstZone.id });
    window.history.replaceState({}, "", window.location.pathname);
    history.pushState({ view: "graph" }, "");
  }, [zones, zonePairs]);

  // Derive selectedPair from zonePairs so it auto-syncs on refresh
  const selectedPair = useMemo(() => {
    if (!selectedPairKey) return null;
    return zonePairs.find(
      (zp) => zp.source_zone_id === selectedPairKey.sourceZoneId && zp.destination_zone_id === selectedPairKey.destZoneId,
    ) ?? null;
  }, [zonePairs, selectedPairKey]);

  const getZoneName = useMemo(() => {
    const map = new Map<string, string>();
    for (const z of zones) {
      map.set(z.id, z.name);
    }
    return (id: string) => map.get(id) ?? "Unknown";
  }, [zones]);

  const handleEdgeSelect = useCallback((pair: ZonePair) => {
    setSelectedPairKey({ sourceZoneId: pair.source_zone_id, destZoneId: pair.destination_zone_id });
  }, []);

  const handleCellClick = useCallback((pair: ZonePair) => {
    setFocusZoneIds([pair.source_zone_id, pair.destination_zone_id]);
    setSelectedPairKey({ sourceZoneId: pair.source_zone_id, destZoneId: pair.destination_zone_id });
    history.pushState({ view: "graph" }, "");
  }, []);

  const handleZoneClick = useCallback((zoneId: string) => {
    setFocusZoneIds([zoneId]);
    setSelectedPairKey(null);
    history.pushState({ view: "graph" }, "");
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setFocusZoneIds(null);
      setSelectedPairKey(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const showLoadingOverlay = dataLoading && zones.length === 0;
  const errorMessage = formatError(dataError);

  const toggleLabel = hasHiddenZones && hasDisabledRules
    ? "Show filtered zones and disabled rules"
    : hasHiddenZones
      ? "Show filtered zones"
      : "Show disabled rules";

  const btnClass =
    "rounded-lg border border-gray-300 dark:border-noc-border px-3 py-1.5 text-sm text-gray-600 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised hover:text-gray-900 dark:hover:text-noc-text hover:border-gray-400 dark:hover:border-noc-border-hover cursor-pointer transition-all";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-noc-border bg-white dark:bg-noc-surface shrink-0">
        {(hasHiddenZones || hasDisabledRules) && (
          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-noc-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => onShowHiddenChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 dark:border-noc-border text-ub-blue focus:ring-ub-blue bg-white dark:bg-noc-input accent-ub-blue"
            />
            {toggleLabel}
          </label>
        )}
        <div className="ml-auto" />
        <button
          onClick={onRefresh}
          disabled={dataLoading}
          className={`${btnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {dataLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        {errorMessage && (
          <div className="absolute top-0 left-0 right-0 bg-red-50 dark:bg-status-danger-dim border-b border-red-200 dark:border-status-danger/20 px-4 py-2 text-sm text-red-700 dark:text-status-danger z-10">
            {errorMessage}
          </div>
        )}
        {showLoadingOverlay ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-noc-border border-t-ub-blue animate-spin" />
            <p className="text-sm text-gray-500 dark:text-noc-text-secondary font-body animate-pulse">
              Connecting to controller...
            </p>
          </div>
        ) : focusZoneIds ? (
          <div className="flex-1 relative">
            <button
              onClick={() => history.back()}
              className="absolute top-3 left-3 z-10 rounded-lg bg-white dark:bg-noc-surface border border-gray-300 dark:border-noc-border px-3 py-1.5 text-sm text-gray-700 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised hover:dark:text-noc-text shadow-sm dark:shadow-lg cursor-pointer transition-all"
            >
              Back to matrix
            </button>
            <ZoneGraph
              zones={zones}
              zonePairs={filteredZonePairs}
              colorMode={colorMode}
              onEdgeSelect={handleEdgeSelect}
              focusZoneIds={focusZoneIds}
              hiddenZoneIds={hiddenZoneIds}
              showHidden={showHidden}
            />
          </div>
        ) : (
          <>
            <MatrixSidebar
              zones={zones}
              hiddenZoneIds={hiddenZoneIds}
              onToggleZone={onToggleZone}
            />
            <ZoneMatrix
              zones={visibleZones}
              zonePairs={filteredZonePairs}
              onCellClick={handleCellClick}
              onZoneClick={handleZoneClick}
            />
          </>
        )}
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
      </div>
    </div>
  );
}
