import { useCallback, useEffect, useMemo, useReducer } from "react";
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

interface AppState {
  authed: boolean;
  authLoading: boolean;
  colorMode: ColorMode;
  showDisabled: boolean;
  selectedPair: ZonePair | null;
  focusZoneIds: string[] | null;
  settingsOpen: boolean;
  aiConfigured: boolean;
}

const initialAppState: AppState = {
  authed: false,
  authLoading: true,
  colorMode: "dark" as ColorMode,
  showDisabled: false,
  selectedPair: null,
  focusZoneIds: null,
  settingsOpen: false,
  aiConfigured: false,
};

function initAppState(): AppState {
  const stored = localStorage.getItem("colorMode");
  const colorMode: ColorMode = stored === "light" || stored === "dark" ? stored : "dark";
  return { ...initialAppState, colorMode };
}

function appReducer(state: AppState, update: Partial<AppState>): AppState {
  return { ...state, ...update };
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState, initAppState);
  const { authed, authLoading, colorMode, showDisabled, selectedPair, focusZoneIds, settingsOpen, aiConfigured } = state;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", colorMode === "dark");
  }, [colorMode]);

  const { zones, zonePairs, loading, error, refresh } = useFirewallData(authed);

  const refreshAiConfig = useCallback(() => {
    api.getAiConfig()
      .then((config) => dispatch({ aiConfigured: config.has_key }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((status) => {
        dispatch({ authed: status.configured });
        if (status.configured) {
          refreshAiConfig();
        }
      })
      .catch(() => {
        dispatch({ authed: false });
      })
      .finally(() => {
        dispatch({ authLoading: false });
      });
  }, [refreshAiConfig]);

  const handleLogout = useCallback(async () => {
    await api.logout();
    dispatch({ authed: false });
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
    dispatch({ selectedPair: pair });
  }, []);

  const handleCellClick = useCallback((pair: ZonePair) => {
    dispatch({ focusZoneIds: [pair.source_zone_id, pair.destination_zone_id], selectedPair: pair });
    history.pushState({ view: "graph" }, "");
  }, []);

  const handleZoneClick = useCallback((zoneId: string) => {
    dispatch({ focusZoneIds: [zoneId], selectedPair: null });
    history.pushState({ view: "graph" }, "");
  }, []);

  useEffect(() => {
    const onPopState = () => {
      dispatch({ focusZoneIds: null, selectedPair: null });
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
    return <LoginScreen onLoggedIn={() => dispatch({ authed: true })} />;
  }

  return (
    <div
      className="h-screen flex flex-col"
    >
      <Toolbar
        colorMode={colorMode}
        onColorModeChange={(mode: ColorMode) => { localStorage.setItem("colorMode", mode); dispatch({ colorMode: mode }); }}
        showDisabled={showDisabled}
        onShowDisabledChange={(val: boolean) => dispatch({ showDisabled: val })}
        onRefresh={refresh}
        loading={loading}
        onLogout={handleLogout}
        onOpenSettings={() => dispatch({ settingsOpen: true })}
      />
      {settingsOpen && <SettingsModal onClose={() => { dispatch({ settingsOpen: false }); refreshAiConfig(); }} />}
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
            onClose={() => dispatch({ selectedPair: null })}
          />
        )}
      </div>
    </div>
  );
}

export default App;
