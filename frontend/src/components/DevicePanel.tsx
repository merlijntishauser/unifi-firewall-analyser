import type { TopologyDevice, TopologyPort } from "../api/types";

interface DevicePanelProps {
  device: TopologyDevice;
  onClose: () => void;
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "online"
      ? "bg-status-success"
      : status === "offline"
        ? "bg-status-danger"
        : "bg-gray-400 dark:bg-noc-text-dim";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

function formatSpeed(speed: number | null): string {
  if (speed === null || speed === 0) return "Down";
  if (speed === 1000) return "1G";
  if (speed === 2500) return "2.5G";
  if (speed === 10000) return "10G";
  return `${speed}M`;
}

function PortRow({ port }: { port: TopologyPort }) {
  const dimmed = !port.up;
  const rowClass = dimmed
    ? "text-gray-400 dark:text-noc-text-dim"
    : "text-gray-700 dark:text-noc-text-secondary";

  return (
    <tr className={`border-t border-gray-100 dark:border-noc-border ${rowClass}`}>
      <td className="py-1 pr-2 text-xs font-mono">{port.idx}</td>
      <td className="py-1 pr-2 text-xs font-mono">{formatSpeed(port.speed)}</td>
      <td className="py-1 pr-2 text-xs truncate max-w-[100px]">{port.connected_device ?? "--"}</td>
      <td className="py-1 pr-2 text-xs font-mono">
        {port.poe && port.poe_power ? `${port.poe_power}W` : "--"}
      </td>
      <td className="py-1 text-xs font-mono">{port.native_vlan ?? "--"}</td>
    </tr>
  );
}

export default function DevicePanel({ device, onClose }: DevicePanelProps) {
  const sortedPorts = [...device.ports].sort((a, b) => a.idx - b.idx);
  const poeBudget = sortedPorts
    .filter((p) => p.poe && p.poe_power !== null && p.poe_power > 0)
    .reduce((sum, p) => sum + (p.poe_power ?? 0), 0);

  return (
    <div className="w-[380px] h-full border-l border-gray-200 dark:border-noc-border bg-white dark:bg-noc-surface flex flex-col overflow-hidden animate-slide-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-noc-border">
        <h2 className="text-sm font-display font-semibold text-gray-900 dark:text-noc-text truncate">
          {device.name}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 dark:text-noc-text-dim hover:text-gray-600 dark:hover:text-noc-text text-lg leading-none cursor-pointer transition-colors"
          aria-label="Close panel"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Summary */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <StatusDot status={device.status} />
            <span className="text-sm text-gray-700 dark:text-noc-text-secondary capitalize">
              {device.status}
            </span>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <span className="text-gray-500 dark:text-noc-text-dim">IP</span>
            <span className="font-mono text-gray-700 dark:text-noc-text-secondary">{device.ip}</span>

            <span className="text-gray-500 dark:text-noc-text-dim">MAC</span>
            <span className="font-mono text-gray-700 dark:text-noc-text-secondary">{device.mac}</span>

            <span className="text-gray-500 dark:text-noc-text-dim">Model</span>
            <span className="text-gray-700 dark:text-noc-text-secondary">{device.model_name}</span>

            <span className="text-gray-500 dark:text-noc-text-dim">Firmware</span>
            <span className="font-mono text-gray-700 dark:text-noc-text-secondary">{device.version}</span>

            <span className="text-gray-500 dark:text-noc-text-dim">Uptime</span>
            <span className="text-gray-700 dark:text-noc-text-secondary">{formatUptime(device.uptime)}</span>

            <span className="text-gray-500 dark:text-noc-text-dim">Clients</span>
            <span className="text-gray-700 dark:text-noc-text-secondary">{device.client_count}</span>
          </div>
        </div>

        {/* Port table */}
        {sortedPorts.length > 0 && (
          <div>
            <h3 className="text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest mb-2">
              Ports ({sortedPorts.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-noc-border">
                    <th className="pb-1 pr-2 text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">Port</th>
                    <th className="pb-1 pr-2 text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">Speed</th>
                    <th className="pb-1 pr-2 text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">Device</th>
                    <th className="pb-1 pr-2 text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">PoE</th>
                    <th className="pb-1 text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">VLAN</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPorts.map((port) => (
                    <PortRow key={port.idx} port={port} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PoE budget */}
        {poeBudget > 0 && (
          <div className="rounded-lg bg-gray-50 dark:bg-noc-raised border border-gray-200 dark:border-noc-border p-2.5">
            <span className="text-[10px] font-semibold text-gray-400 dark:text-noc-text-dim uppercase tracking-widest">
              PoE Budget
            </span>
            <p className="text-sm font-mono text-gray-700 dark:text-noc-text-secondary mt-0.5">
              {poeBudget.toFixed(1)}W
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
