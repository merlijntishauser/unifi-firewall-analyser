import { useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { Network } from "../api/types";

export interface ZoneNodeData {
  label: string;
  networks: Network[];
  [key: string]: unknown;
}

export type ZoneNode = Node<ZoneNodeData, "zone">;

const ZONE_COLORS: Record<string, { accent: string; text: string }> = {
  External: { accent: "border-l-red-500", text: "text-red-400" },
  Internal: { accent: "border-l-blue-500", text: "text-blue-400" },
  Guest: { accent: "border-l-green-500", text: "text-green-400" },
  VPN: { accent: "border-l-purple-500", text: "text-purple-400" },
  Gateway: { accent: "border-l-yellow-500", text: "text-yellow-400" },
  IoT: { accent: "border-l-teal-500", text: "text-teal-400" },
  DMZ: { accent: "border-l-orange-500", text: "text-orange-400" },
};

const DEFAULT_COLORS = {
  accent: "border-l-gray-500",
  text: "text-gray-400",
};

function getZoneColors(name: string) {
  return ZONE_COLORS[name] ?? DEFAULT_COLORS;
}

export default function ZoneNodeComponent({ data }: NodeProps<ZoneNode>) {
  const [expanded, setExpanded] = useState(false);
  const colors = getZoneColors(data.label);
  const networks = data.networks;

  return (
    <div
      className={`rounded-lg border border-gray-200 dark:border-noc-border ${colors.accent} border-l-[3px] bg-white dark:bg-noc-raised shadow-md dark:shadow-lg min-w-[200px]`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 dark:!bg-noc-text-dim" />

      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-display font-semibold text-sm ${colors.text}`}>
            {data.label}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-noc-input px-2 py-0.5 text-xs font-mono font-medium text-gray-600 dark:text-noc-text-secondary">
            {networks.length}
          </span>
        </div>

        {networks.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs text-gray-500 dark:text-noc-text-dim hover:text-gray-700 dark:hover:text-noc-text-secondary cursor-pointer transition-colors"
          >
            {expanded ? "Hide networks" : "Show networks"}
          </button>
        )}

        {expanded && (
          <ul className="mt-2 space-y-1">
            {networks.map((net) => (
              <li
                key={net.id}
                className="text-xs text-gray-600 dark:text-noc-text-secondary border-t border-gray-100 dark:border-noc-border pt-1"
              >
                <span className="font-medium">{net.name}</span>
                {net.vlan_id != null && (
                  <span className="ml-1 font-mono text-gray-400 dark:text-noc-text-dim">
                    VLAN {net.vlan_id}
                  </span>
                )}
                {net.subnet && (
                  <span className="ml-1 font-mono text-gray-400 dark:text-noc-text-dim">
                    {net.subnet}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 dark:!bg-noc-text-dim" />
    </div>
  );
}
