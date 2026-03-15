import { useCallback, useEffect, useRef, useState } from "react";
import type { TopologyDevice, TopologyDevicesResponse, TopologySvgResponse } from "../api/types";
import { useAppContext } from "../hooks/useAppContext";
import { useTopologySvg, useTopologyDevices } from "../hooks/queries";
import { downloadSvg, downloadPng } from "../utils/export";
import SvgViewer from "./SvgViewer";
import DeviceMap from "./DeviceMap";
import DevicePanel from "./DevicePanel";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ColorMode } from "@xyflow/react";

function readStorage(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function LoadingSpinner({ message }: { message: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <div className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-noc-border border-t-ub-blue animate-spin" />
      <p className="text-sm text-gray-500 dark:text-noc-text-secondary font-body">{message}</p>
    </div>
  );
}

function ErrorMessage({ error, fallback }: { error: Error | null; fallback: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <p className="text-sm text-status-danger">
        {error instanceof Error ? error.message : fallback}
      </p>
    </div>
  );
}

function MapContent({
  query,
  colorMode,
  selectedDevice,
  onDeviceSelect,
  onClosePanel,
}: {
  query: UseQueryResult<TopologyDevicesResponse>;
  colorMode: ColorMode;
  selectedDevice: TopologyDevice | null;
  onDeviceSelect: (d: TopologyDevice) => void;
  onClosePanel: () => void;
}) {
  if (query.isLoading) return <LoadingSpinner message="Loading devices..." />;
  if (query.error) return <ErrorMessage error={query.error as Error} fallback="Failed to load devices" />;
  const devices = query.data?.devices ?? [];
  const edges = query.data?.edges ?? [];
  return (
    <>
      <div className="flex-1">
        <DeviceMap devices={devices} edges={edges} colorMode={colorMode} onDeviceSelect={onDeviceSelect} />
      </div>
      {selectedDevice && (
        <DevicePanel key={selectedDevice.mac} device={selectedDevice} onClose={onClosePanel} />
      )}
    </>
  );
}

function DiagramContent({ query }: { query: UseQueryResult<TopologySvgResponse> }) {
  if (query.isLoading) return <LoadingSpinner message="Rendering topology..." />;
  if (query.error) return <ErrorMessage error={query.error as Error} fallback="Failed to render topology" />;
  if (query.data) return <SvgViewer svgContent={query.data.svg} />;
  return null;
}

const BTN = "rounded-lg border border-gray-300 dark:border-noc-border px-3 py-1.5 text-sm text-gray-600 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised hover:text-gray-900 dark:hover:text-noc-text hover:border-gray-400 dark:hover:border-noc-border-hover cursor-pointer transition-all";
const BTN_ACTIVE = "rounded-lg border border-ub-blue px-3 py-1.5 text-sm text-ub-blue bg-blue-50 dark:bg-ub-blue-dim cursor-pointer transition-all";

export default function TopologyModule() {
  const { colorMode, connectionInfo } = useAppContext();
  const authed = connectionInfo !== null;

  const [subView, setSubView] = useState<"map" | "diagram">(() =>
    readStorage("topologySubView", "map") as "map" | "diagram",
  );
  const [projection, setProjection] = useState<"orthogonal" | "isometric">(() =>
    readStorage("topologyProjection", "isometric") as "orthogonal" | "isometric",
  );
  const deepLinkDevice = useRef(new URLSearchParams(window.location.search).get("device"));
  const [selectedDevice, setSelectedDevice] = useState<TopologyDevice | null>(null);

  const svgQuery = useTopologySvg(colorMode === "dark" ? "dark" : "light", projection, authed && subView === "diagram");
  const devicesQuery = useTopologyDevices(authed);

  // Deep-link: ?device=mac -- resolve once device data is available
  useEffect(() => {
    if (!deepLinkDevice.current || !devicesQuery.data) return;
    const mac = deepLinkDevice.current;
    deepLinkDevice.current = null;
    const device = devicesQuery.data.devices.find((d) => d.mac === mac);
    if (!device) return;
    setSelectedDevice(device);
    window.history.replaceState({}, "", window.location.pathname);
  }, [devicesQuery.data]);

  const handleSubViewChange = useCallback((view: "map" | "diagram") => {
    setSubView(view);
    try { localStorage.setItem("topologySubView", view); } catch { /* noop */ }
  }, []);

  const handleProjectionChange = useCallback(() => {
    const next = projection === "isometric" ? "orthogonal" : "isometric";
    setProjection(next);
    try { localStorage.setItem("topologyProjection", next); } catch { /* noop */ }
  }, [projection]);

  const segmentClass = (active: boolean, isFirst: boolean) =>
    `px-3 py-1.5 text-sm transition-colors ${!isFirst ? "border-l border-gray-300 dark:border-noc-border" : ""} ${
      active ? "bg-blue-50 dark:bg-ub-blue-dim text-ub-blue font-medium" : "text-gray-600 dark:text-noc-text-secondary hover:bg-gray-100 dark:hover:bg-noc-raised"
    }`;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-noc-border bg-white dark:bg-noc-surface shrink-0">
        <div className="flex rounded-lg border border-gray-300 dark:border-noc-border overflow-hidden">
          <button onClick={() => handleSubViewChange("map")} className={segmentClass(subView === "map", true)}>Map</button>
          <button onClick={() => handleSubViewChange("diagram")} className={segmentClass(subView === "diagram", false)}>Diagram</button>
        </div>
        {subView === "diagram" && (
          <>
            <button onClick={handleProjectionChange} className={projection === "isometric" ? BTN_ACTIVE : BTN}>Isometric</button>
            {svgQuery.data && (
              <>
                <button onClick={() => downloadSvg(svgQuery.data.svg)} className={BTN}>Export SVG</button>
                <button onClick={() => downloadPng(svgQuery.data.svg)} className={BTN}>Export PNG</button>
              </>
            )}
          </>
        )}
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        {subView === "map" ? (
          <MapContent
            query={devicesQuery}
            colorMode={colorMode}
            selectedDevice={selectedDevice}
            onDeviceSelect={setSelectedDevice}
            onClosePanel={() => setSelectedDevice(null)}
          />
        ) : (
          <DiagramContent query={svgQuery} />
        )}
      </div>
    </div>
  );
}
