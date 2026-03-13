import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { ColorMode } from "@xyflow/react";
import type { ZonePair } from "./api/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  queryKeys,
  useZoneFilter,
  useLogout,
  useSaveZoneFilter,
} from "./hooks/queries";
import { useAuthFlow } from "./hooks/useAuth";
import { useFirewallQueries } from "./hooks/useFirewallQueries";
import { useAiInfo } from "./hooks/useAiInfo";
import LoginScreen from "./components/LoginScreen";
import MatrixSidebar from "./components/MatrixSidebar";
import PassphraseScreen from "./components/PassphraseScreen";
import SettingsModal from "./components/SettingsModal";
import Toolbar from "./components/Toolbar";
import ZoneGraph from "./components/ZoneGraph";
import ZoneMatrix from "./components/ZoneMatrix";
import RulePanel from "./components/RulePanel";

interface AppState {
  colorMode: ColorMode;
  showHidden: boolean;
  selectedPair: ZonePair | null;
  focusZoneIds: string[] | null;
  settingsOpen: boolean;
  hiddenZoneIds: Set<string>;
}

const initialAppState: AppState = {
  colorMode: "dark" as ColorMode,
  showHidden: false,
  selectedPair: null,
  focusZoneIds: null,
  settingsOpen: false,
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

function getLoadingMessage(authLoading: boolean, dataLoading: boolean): string | null {
  if (authLoading) return "Checking authentication...";
  if (dataLoading) return "Connecting to controller...";
  return null;
}

function formatError(error: Error | null): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : String(error);
}

function LoadingOverlay({ message }: { message: string | null }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-noc-border border-t-ub-blue animate-spin" />
      {message && (
        <p className="text-sm text-gray-500 dark:text-noc-text-secondary font-body animate-pulse">{message}</p>
      )}
    </div>
  );
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState, initAppState);
  const { colorMode, showHidden, selectedPair, focusZoneIds, settingsOpen, hiddenZoneIds } = state;
  const qc = useQueryClient();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", colorMode === "dark");
  }, [colorMode]);

  const { appAuthRequired, appAuthenticated, authed, authLoading, connectionInfo, refetchAppAuth, refetchAuth } = useAuthFlow();
  const { zones, zonePairs, dataLoading, dataError } = useFirewallQueries(authed);
  const { aiConfigured, aiInfo } = useAiInfo(authed);

  const zoneFilterQuery = useZoneFilter(authed);

  // Sync hiddenZoneIds from server when filter data arrives
  const lastFilterRef = useRef<string[] | undefined>(undefined);
  useEffect(() => {
    const serverIds = zoneFilterQuery.data?.hidden_zone_ids;
    if (serverIds && serverIds !== lastFilterRef.current) {
      lastFilterRef.current = serverIds;
      dispatch({ hiddenZoneIds: new Set(serverIds) });
    }
  }, [zoneFilterQuery.data]);

  // --- Mutations ---
  const logoutMutation = useLogout();
  const saveZoneFilterMutation = useSaveZoneFilter();

  const handleLogout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    dispatch({ selectedPair: null, focusZoneIds: null });
  }, [logoutMutation]);

  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.zones });
    qc.invalidateQueries({ queryKey: queryKeys.zonePairs });
  }, [qc]);

  // Keep selectedPair in sync when zonePairs refreshes (e.g. after toggle/reorder)
  useEffect(() => {
    if (selectedPair && zonePairs.length > 0) {
      const updated = zonePairs.find(
        (zp) => zp.source_zone_id === selectedPair.source_zone_id && zp.destination_zone_id === selectedPair.destination_zone_id,
      );
      if (updated && updated !== selectedPair) {
        dispatch({ selectedPair: updated });
      }
    }
  }, [zonePairs, selectedPair]);

  const getZoneName = useMemo(() => {
    const map = new Map<string, string>();
    for (const z of zones) {
      map.set(z.id, z.name);
    }
    return (id: string) => map.get(id) ?? "Unknown";
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

  const saveTimerRef = useRef<number | undefined>(undefined);

  const handleToggleZone = useCallback((zoneId: string) => {
    dispatch((prev) => {
      const next = new Set(prev.hiddenZoneIds);
      if (next.has(zoneId)) {
        next.delete(zoneId);
      } else {
        next.add(zoneId);
      }
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        saveZoneFilterMutation.mutate([...next]);
      }, 300);
      return { hiddenZoneIds: next };
    });
  }, [saveZoneFilterMutation]);

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

  if (appAuthRequired && !appAuthenticated && !authLoading) {
    return (
      <PassphraseScreen
        onAuthenticated={() => {
          refetchAppAuth();
        }}
      />
    );
  }

  if (!authed && !authLoading) {
    return <LoginScreen onLoggedIn={() => refetchAuth()} />;
  }

  const showLoadingOverlay = authLoading || (dataLoading && zones.length === 0);
  const loadingMessage = getLoadingMessage(authLoading, dataLoading);
  const errorMessage = formatError(dataError);

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
        onRefresh={handleRefresh}
        loading={dataLoading}
        onLogout={handleLogout}
        onOpenSettings={() => dispatch({ settingsOpen: true })}
        connectionInfo={connectionInfo}
        aiInfo={aiInfo}
      />
      {settingsOpen && <SettingsModal onClose={() => { dispatch({ settingsOpen: false }); qc.invalidateQueries({ queryKey: queryKeys.aiConfig }); }} />}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-status-danger-dim border-b border-red-200 dark:border-status-danger/20 px-4 py-2 text-sm text-red-700 dark:text-status-danger">
          {errorMessage}
        </div>
      )}
      <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-noc-bg">
        {showLoadingOverlay ? (
          <LoadingOverlay message={loadingMessage} />
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
            sourceZoneName={getZoneName(selectedPair.source_zone_id)}
            destZoneName={getZoneName(selectedPair.destination_zone_id)}
            aiConfigured={aiConfigured}
            onClose={() => dispatch({ selectedPair: null })}
            onRuleUpdated={handleRefresh}
          />
        )}
      </div>
    </div>
  );
}

export default App;
