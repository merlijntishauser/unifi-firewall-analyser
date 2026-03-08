import { useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { Network } from "../api/types";

export interface ZoneNodeData {
  label: string;
  networks: Network[];
  [key: string]: unknown;
}

export type ZoneNode = Node<ZoneNodeData, "zone">;

const ZONE_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  External: { border: "border-red-500", bg: "bg-red-50 dark:bg-red-950", text: "text-red-700 dark:text-red-300" },
  Internal: { border: "border-blue-500", bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-300" },
  Guest: { border: "border-green-500", bg: "bg-green-50 dark:bg-green-950", text: "text-green-700 dark:text-green-300" },
  VPN: { border: "border-purple-500", bg: "bg-purple-50 dark:bg-purple-950", text: "text-purple-700 dark:text-purple-300" },
  Gateway: { border: "border-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-950", text: "text-yellow-700 dark:text-yellow-300" },
  IoT: { border: "border-teal-500", bg: "bg-teal-50 dark:bg-teal-950", text: "text-teal-700 dark:text-teal-300" },
  DMZ: { border: "border-orange-500", bg: "bg-orange-50 dark:bg-orange-950", text: "text-orange-700 dark:text-orange-300" },
};

const DEFAULT_COLORS = {
  border: "border-gray-500",
  bg: "bg-gray-50 dark:bg-gray-800",
  text: "text-gray-700 dark:text-gray-300",
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
      className={`rounded-lg border-2 ${colors.border} ${colors.bg} shadow-md min-w-[200px]`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-semibold text-sm ${colors.text}`}>
            {data.label}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
            {networks.length}
          </span>
        </div>

        {networks.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
          >
            {expanded ? "Hide networks" : "Show networks"}
          </button>
        )}

        {expanded && (
          <ul className="mt-2 space-y-1">
            {networks.map((net) => (
              <li
                key={net.id}
                className="text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-1"
              >
                <span className="font-medium">{net.name}</span>
                {net.vlan_id != null && (
                  <span className="ml-1 text-gray-400 dark:text-gray-500">
                    VLAN {net.vlan_id}
                  </span>
                )}
                {net.subnet && (
                  <span className="ml-1 text-gray-400 dark:text-gray-500">
                    {net.subnet}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400"
      />
    </div>
  );
}
