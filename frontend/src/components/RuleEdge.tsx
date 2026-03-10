import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import { getActionColor, getEdgeColor } from "../utils/edgeColor";

export interface RuleSummary {
  name: string;
  action: string;
  protocol: string;
  portRanges: string[];
  enabled: boolean;
}

export interface RuleEdgeData {
  rules: RuleSummary[];
  allowCount: number;
  blockCount: number;
  edgeOffset?: number;
  sourceZoneName?: string;
  destZoneName?: string;
  onLabelClick?: () => void;
  [key: string]: unknown;
}

export type RuleEdge = Edge<RuleEdgeData, "rule">;

const MAX_VISIBLE = 4;

const DATA_DEFAULTS: Omit<RuleEdgeData, "onLabelClick"> = {
  rules: [],
  allowCount: 0,
  blockCount: 0,
};

function resolveData(data: RuleEdgeData | undefined): RuleEdgeData {
  if (!data) return { ...DATA_DEFAULTS };
  return data;
}

function formatPortLabel(protocol: string, portRanges: string[]): string | null {
  if (portRanges.length > 0) return `${protocol}:${portRanges.join(",")}`;
  return protocol || null;
}

export default function RuleEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<RuleEdge>) {
  const {
    rules,
    allowCount,
    blockCount,
    onLabelClick,
    edgeOffset = 0,
    sourceZoneName,
    destZoneName,
  } = resolveData(data);
  const color = getEdgeColor(allowCount, blockCount);

  const EDGE_OFFSET_PX = 25;
  const offsetX = edgeOffset * EDGE_OFFSET_PX;

  // For upward edges (source below target), flip handle positions so the path
  // goes straight up instead of S-curving and the arrowhead points upward.
  const isUpward = sourceY > targetY;

  const [edgePath] = getSmoothStepPath({
    sourceX: sourceX + offsetX,
    sourceY,
    sourcePosition: isUpward ? Position.Top : sourcePosition,
    targetX: targetX + offsetX,
    targetY,
    targetPosition: isUpward ? Position.Bottom : targetPosition,
  });

  // Position label near source (not midpoint) to avoid overlapping intermediate nodes
  const LABEL_OFFSET = 90;
  const dy = targetY - sourceY;
  const clampedOffset = Math.sign(dy) * Math.min(LABEL_OFFSET, Math.abs(dy) * 0.4);
  const labelPosX = (sourceX + targetX) / 2 + offsetX;
  const labelPosY = sourceY + clampedOffset;
  // Place label on the outer side for bidirectional edges
  const labelAnchor =
    edgeOffset < 0
      ? "translate(calc(-100% - 12px), -50%)"
      : "translate(12px, -50%)";

  const visibleRules = rules.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, rules.length - MAX_VISIBLE);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
        }}
      />
      <EdgeLabelRenderer>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLabelClick?.();
          }}
          className="nopan nodrag rounded px-1.5 py-1 cursor-pointer max-w-[200px] bg-white/90 dark:bg-noc-bg/90 backdrop-blur-sm border border-gray-200/50 dark:border-noc-border/30 shadow-sm hover:shadow-md transition-shadow"
          style={{
            position: "absolute",
            transform: `${labelAnchor} translate(${labelPosX}px,${labelPosY}px)`,
            pointerEvents: "all",
          }}
        >
          {sourceZoneName && destZoneName && (
            <div className="text-[8px] text-gray-400 dark:text-noc-text-dim pb-0.5 text-left border-b border-gray-200/30 dark:border-noc-border/20 mb-0.5">
              {sourceZoneName} &rarr; {destZoneName}
            </div>
          )}
          {visibleRules.map((rule, i) => {
            const portLabel = formatPortLabel(rule.protocol, rule.portRanges);
            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 py-0.5 ${rule.enabled ? "" : "opacity-40"}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: getActionColor(rule.action) }}
                />
                <span className="text-[10px] font-medium text-gray-600 dark:text-noc-text-secondary truncate flex-1 text-left">
                  {rule.name}
                </span>
                {portLabel && (
                  <span className="text-[8px] font-mono text-gray-400 dark:text-noc-text-dim shrink-0">
                    {portLabel}
                  </span>
                )}
              </div>
            );
          })}
          {overflow > 0 && (
            <div className="text-[10px] text-gray-400 dark:text-noc-text-dim pt-0.5 text-left">
              +{overflow} more
            </div>
          )}
          {rules.length === 0 && (
            <div className="text-[10px] text-gray-400 dark:text-noc-text-dim py-0.5 text-left">
              No active rules
            </div>
          )}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
