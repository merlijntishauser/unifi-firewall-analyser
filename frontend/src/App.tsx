import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColorMode } from "@xyflow/react";
import { api } from "./api/client";
import type { ZonePair } from "./api/types";
import { useFirewallData } from "./hooks/useFirewallData";
import LoginScreen from "./components/LoginScreen";
import SettingsModal from "./components/SettingsModal";
import Toolbar from "./components/Toolbar";
import ZoneGraph from "./components/ZoneGraph";
import ZoneMatrix from "./components/ZoneMatrix";
import RulePanel from "./components/RulePanel";

function App() {
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [colorMode, setColorMode] = useState<ColorMode>("dark");
  const [showDisabled, setShowDisabled] = useState(false);
  const [selectedPair, setSelectedPair] = useState<ZonePair | null>(null);
  const [focusZoneIds, setFocusZoneIds] = useState<string[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);

  const { zones, zonePairs, loading, error, refresh } = useFirewallData(authed);

  const refreshAiConfig = useCallback(() => {
    api.getAiConfig()
      .then((config) => setAiConfigured(config.has_key))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((status) => {
        setAuthed(status.configured);
        if (status.configured) {
          refreshAiConfig();
        }
      })
      .catch(() => {
        setAuthed(false);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, [refreshAiConfig]);

  const handleLogout = useCallback(async () => {
    await api.logout();
    setAuthed(false);
  }, []);

  const zoneNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const z of zones) {
      map.set(z.id, z.name);
    }
    return map;
  }, [zones]);

  const filteredZonePairs = useMemo(() => {
    if (showDisabled) return zonePairs;
    return zonePairs.map((pair) => ({
      ...pair,
      rules: pair.rules.filter((r) => r.enabled),
    }));
  }, [zonePairs, showDisabled]);

  const handleEdgeSelect = useCallback((pair: ZonePair) => {
    setSelectedPair(pair);
  }, []);

  const handleCellClick = useCallback((pair: ZonePair) => {
    setFocusZoneIds([pair.source_zone_id, pair.destination_zone_id]);
    setSelectedPair(pair);
    history.pushState({ view: "graph" }, "");
  }, []);

  const handleZoneClick = useCallback((zoneId: string) => {
    setFocusZoneIds([zoneId]);
    setSelectedPair(null);
    history.pushState({ view: "graph" }, "");
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setFocusZoneIds(null);
      setSelectedPair(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-noc-bg text-gray-400 dark:text-noc-text-secondary font-body">
        Loading...
      </div>
    );
  }

  if (!authed) {
    return <LoginScreen onLoggedIn={() => setAuthed(true)} />;
  }

  return (
    <div
      className={`h-screen flex flex-col ${colorMode === "dark" ? "dark" : ""}`}
    >
      <Toolbar
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        showDisabled={showDisabled}
        onShowDisabledChange={setShowDisabled}
        onRefresh={refresh}
        loading={loading}
        onLogout={handleLogout}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {settingsOpen && <SettingsModal onClose={() => { setSettingsOpen(false); refreshAiConfig(); }} />}
      {error && (
        <div className="bg-red-50 dark:bg-status-danger-dim border-b border-red-200 dark:border-status-danger/20 px-4 py-2 text-sm text-red-700 dark:text-status-danger">
          {error}
        </div>
      )}
      <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-noc-bg">
        <div className="flex-1 relative">
          {focusZoneIds ? (
            <>
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
              />
            </>
          ) : (
            <ZoneMatrix
              zones={zones}
              zonePairs={filteredZonePairs}
              onCellClick={handleCellClick}
              onZoneClick={handleZoneClick}
            />
          )}
        </div>
        {selectedPair && (
          <RulePanel
            key={`${selectedPair.source_zone_id}-${selectedPair.destination_zone_id}`}
            pair={selectedPair}
            sourceZoneName={
              zoneNameMap.get(selectedPair.source_zone_id) ?? "Unknown"
            }
            destZoneName={
              zoneNameMap.get(selectedPair.destination_zone_id) ?? "Unknown"
            }
            aiConfigured={aiConfigured}
            onClose={() => setSelectedPair(null)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
