import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { ColorMode } from "@xyflow/react";
import { api } from "./api/client";
import type { ZonePair } from "./api/types";
import { useFirewallData } from "./hooks/useFirewallData";
import LoginScreen from "./components/LoginScreen";
import MatrixSidebar from "./components/MatrixSidebar";
import SettingsModal from "./components/SettingsModal";
import Toolbar from "./components/Toolbar";
import ZoneGraph from "./components/ZoneGraph";
import ZoneMatrix from "./components/ZoneMatrix";
import RulePanel from "./components/RulePanel";

interface AppState {
  authed: boolean;
  authLoading: boolean;
  colorMode: ColorMode;
  showHidden: boolean;
  selectedPair: ZonePair | null;
  focusZoneIds: string[] | null;
  settingsOpen: boolean;
  aiConfigured: boolean;
  hiddenZoneIds: Set<string>;
}

const initialAppState: AppState = {
  authed: false,
  authLoading: true,
  colorMode: "dark" as ColorMode,
  showHidden: false,
  selectedPair: null,
  focusZoneIds: null,
  settingsOpen: false,
  aiConfigured: false,
  hiddenZoneIds: new Set<string>(),
};

function initAppState(): AppState {
  const stored = localStorage.getItem("colorMode");
  const colorMode: ColorMode = stored === "light" || stored === "dark" ? stored : "dark";
  return { ...initialAppState, colorMode };
}

type AppAction = Partial<AppState> | ((prev: AppState) => Partial<AppState>);

function appReducer(state: AppState, action: AppAction): AppState {
  const update = typeof action === "function" ? action(state) : action;
  return { ...state, ...update };
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState, initAppState);
  const { authed, authLoading, colorMode, showHidden, selectedPair, focusZoneIds, settingsOpen, aiConfigured, hiddenZoneIds } = state;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", colorMode === "dark");
  }, [colorMode]);

  const { zones, zonePairs, loading, error, refresh } = useFirewallData(authed);

  const refreshAiConfig = useCallback(() => {
    api.getAiConfig()
      .then((config) => dispatch({ aiConfigured: config.has_key }))
      .catch(() => {});
  }, []);

  const refreshZoneFilter = useCallback(() => {
    api.getZoneFilter()
      .then((filter) => dispatch({ hiddenZoneIds: new Set(filter.hidden_zone_ids) }))
      .catch(() => {});
  }, []);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    api
      .getAuthStatus()
      .then((status) => {
        dispatch({ authed: status.configured });
        if (status.configured) {
          refreshAiConfig();
          refreshZoneFilter();
        }
      })
      .catch(() => {
        dispatch({ authed: false });
      })
      .finally(() => {
        dispatch({ authLoading: false });
      });
  }, [refreshAiConfig, refreshZoneFilter]);

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
    if (showHidden) return zonePairs;
    return zonePairs.map((pair) => ({
      ...pair,
      rules: pair.rules.filter((r) => r.enabled),
    }));
  }, [zonePairs, showHidden]);

  const visibleZones = useMemo(() => {
    if (showHidden || hiddenZoneIds.size === 0) return zones;
    return zones.filter((z) => !hiddenZoneIds.has(z.id));
  }, [zones, hiddenZoneIds, showHidden]);

  const hasDisabledRules = useMemo(
    () => zonePairs.some((p) => p.rules.some((r) => !r.enabled)),
    [zonePairs],
  );

  const hasHiddenZones = hiddenZoneIds.size > 0;

  const handleToggleZone = useCallback((zoneId: string) => {
    dispatch((prev) => {
      const next = new Set(prev.hiddenZoneIds);
      if (next.has(zoneId)) {
        next.delete(zoneId);
      } else {
        next.add(zoneId);
      }
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        api.saveZoneFilter([...next]).catch(() => {});
      }, 300);
      return { hiddenZoneIds: next };
    });
  }, []);

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
        showHidden={showHidden}
        onShowHiddenChange={(val: boolean) => dispatch({ showHidden: val })}
        hasHiddenZones={hasHiddenZones}
        hasDisabledRules={hasDisabledRules}
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
        {focusZoneIds ? (
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
              onToggleZone={handleToggleZone}
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
            sourceZoneName={
              zoneNameMap.get(selectedPair.source_zone_id) ?? "Unknown"
            }
            destZoneName={
              zoneNameMap.get(selectedPair.destination_zone_id) ?? "Unknown"
            }
            aiConfigured={aiConfigured}
            onClose={() => dispatch({ selectedPair: null })}
            onRuleUpdated={refresh}
          />
        )}
      </div>
    </div>
  );
}

export default App;
