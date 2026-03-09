import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColorMode } from "@xyflow/react";
import { api } from "./api/client";
import type { ZonePair } from "./api/types";
import { useFirewallData } from "./hooks/useFirewallData";
import LoginScreen from "./components/LoginScreen";
import Toolbar from "./components/Toolbar";
import ZoneGraph from "./components/ZoneGraph";
import ZoneMatrix from "./components/ZoneMatrix";
import RulePanel from "./components/RulePanel";

function App() {
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [colorMode, setColorMode] = useState<ColorMode>("light");
  const [showDisabled, setShowDisabled] = useState(false);
  const [selectedPair, setSelectedPair] = useState<ZonePair | null>(null);
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);

  const { zones, zonePairs, loading, error, refresh } = useFirewallData(authed);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((status) => {
        setAuthed(status.configured);
      })
      .catch(() => {
        setAuthed(false);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

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

  const handleZoneClick = useCallback((zoneId: string) => {
    setFocusZoneId(zoneId);
    setSelectedPair(null);
  }, []);

  const handleBack = useCallback(() => {
    setFocusZoneId(null);
    setSelectedPair(null);
  }, []);

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
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
      />
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          {focusZoneId ? (
            <>
              <button
                onClick={handleBack}
                className="absolute top-3 left-3 z-10 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm cursor-pointer"
              >
                Back to matrix
              </button>
              <ZoneGraph
                zones={zones}
                zonePairs={filteredZonePairs}
                colorMode={colorMode}
                onEdgeSelect={handleEdgeSelect}
                focusZoneId={focusZoneId}
              />
            </>
          ) : (
            <ZoneMatrix
              zones={zones}
              zonePairs={filteredZonePairs}
              onCellClick={handleEdgeSelect}
              onZoneClick={handleZoneClick}
            />
          )}
        </div>
        {selectedPair && (
          <RulePanel
            pair={selectedPair}
            sourceZoneName={
              zoneNameMap.get(selectedPair.source_zone_id) ?? "Unknown"
            }
            destZoneName={
              zoneNameMap.get(selectedPair.destination_zone_id) ?? "Unknown"
            }
            onClose={() => setSelectedPair(null)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
