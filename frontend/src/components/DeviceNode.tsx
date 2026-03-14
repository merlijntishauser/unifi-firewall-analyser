import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export interface DeviceNodeData {
  label: string;
  deviceType: string;
  model: string;
  ip: string;
  status: string;
  clientCount: number;
  onSelect: () => void;
  [key: string]: unknown;
}

export type DeviceNode = Node<DeviceNodeData, "device">;

function StatusDot({ status }: { status: string }) {
  const color =
    status === "online"
      ? "bg-status-success"
      : status === "offline"
        ? "bg-status-danger"
        : "bg-gray-400 dark:bg-noc-text-dim";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function DeviceIcon({ deviceType }: { deviceType: string }) {
  const cls = "h-5 w-5 text-gray-500 dark:text-noc-text-secondary shrink-0";
  switch (deviceType) {
    case "gateway":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="6" rx="1" />
          <rect x="3" y="14" width="18" height="6" rx="1" />
          <circle cx="7" cy="7" r="1" fill="currentColor" />
          <circle cx="7" cy="17" r="1" fill="currentColor" />
          <line x1="11" y1="7" x2="17" y2="7" />
          <line x1="11" y1="17" x2="17" y2="17" />
        </svg>
      );
    case "switch":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="7" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="17" cy="12" r="1.5" />
          <line x1="7" y1="14" x2="7" y2="16" />
          <line x1="12" y1="14" x2="12" y2="16" />
          <line x1="17" y1="14" x2="17" y2="16" />
        </svg>
      );
    case "ap":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <circle cx="12" cy="20" r="1" fill="currentColor" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <line x1="9" y1="9" x2="15" y2="15" />
          <line x1="15" y1="9" x2="9" y2="15" />
        </svg>
      );
  }
}

export default function DeviceNodeComponent({ data }: NodeProps<DeviceNode>) {
  const borderColor = data.deviceType === "gateway" ? "border-ub-blue" : "border-gray-200 dark:border-noc-border";

  return (
    <div
      className={`rounded-lg border ${borderColor} bg-white dark:bg-noc-raised shadow-md dark:shadow-lg w-[200px] cursor-pointer`}
      onClick={data.onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") data.onSelect(); }}
      role="button"
      tabIndex={0}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 dark:!bg-noc-text-dim" />

      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <DeviceIcon deviceType={data.deviceType} />
          <span className="font-display font-semibold text-sm text-gray-900 dark:text-noc-text truncate flex-1">
            {data.label}
          </span>
          <StatusDot status={data.status} />
        </div>

        <div className="mt-1.5 flex flex-col gap-0.5">
          <span className="text-xs font-body text-gray-500 dark:text-noc-text-dim truncate">
            {data.model}
          </span>
          <span className="text-xs font-mono text-gray-500 dark:text-noc-text-dim">
            {data.ip}
          </span>
          <span className="inline-flex items-center self-start rounded-full bg-gray-100 dark:bg-noc-input px-2 py-0.5 text-xs font-mono font-medium text-gray-600 dark:text-noc-text-secondary mt-0.5">
            {data.clientCount} client{data.clientCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 dark:!bg-noc-text-dim" />
    </div>
  );
}
