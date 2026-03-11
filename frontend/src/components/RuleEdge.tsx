import { useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import { getActionColor, getEdgeColor } from "../utils/edgeColor";
import { NODE_HEIGHT } from "../utils/layout";

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
  sourceXOffset?: number;
  targetXOffset?: number;
  sourceZoneName?: string;
  destZoneName?: string;
  onLabelClick?: () => void;
  [key: string]: unknown;
}

export type RuleEdge = Edge<RuleEdgeData, "rule">;

const MAX_VISIBLE = 3;

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

function RuleCardContent({
  rules,
  sourceZoneName,
  destZoneName,
  onLabelClick,
}: {
  rules: RuleSummary[];
  sourceZoneName?: string;
  destZoneName?: string;
  onLabelClick?: () => void;
}) {
  const visibleRules = rules.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, rules.length - MAX_VISIBLE);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onLabelClick?.();
      }}
      className="rounded px-1 py-0.5 max-w-[170px] bg-white/95 dark:bg-noc-bg/95 backdrop-blur-sm border border-gray-200/50 dark:border-noc-border/30 shadow-lg cursor-pointer"
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
  );
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
  const resolved = resolveData(data);
  const {
    rules,
    allowCount,
    blockCount,
    onLabelClick,
    edgeOffset = 0,
    sourceZoneName,
    destZoneName,
  } = resolved;
  const srcOff = resolved.sourceXOffset ?? 0;
  const tgtOff = resolved.targetXOffset ?? 0;
  const color = getEdgeColor(allowCount, blockCount);
  const [isPinned, setIsPinned] = useState(false);

  const isUpward = sourceY > targetY;

  // For upward edges, remap to top-of-source → bottom-of-target so the
  // path never exits and enters on the same side of a node.
  const sy = isUpward ? sourceY - NODE_HEIGHT : sourceY;
  const ty = isUpward ? targetY + NODE_HEIGHT : targetY;

  const [computedPath, labelPosX, labelPosY] = getSmoothStepPath({
    sourceX: sourceX + srcOff,
    sourceY: sy,
    sourcePosition: isUpward ? Position.Top : sourcePosition,
    targetX: targetX + tgtOff,
    targetY: ty,
    targetPosition: isUpward ? Position.Bottom : targetPosition,
    borderRadius: 16,
  });

  const cardSide = edgeOffset < 0 ? "right-full mr-2" : "left-full ml-2";

  return (
    <>
      <BaseEdge
        id={id}
        path={computedPath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nopan nodrag group"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelPosX}px,${labelPosY}px)`,
            pointerEvents: "all",
          }}
        >
          {/* Compact pill - always visible */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsPinned((p) => !p);
            }}
            className="flex items-center gap-1 rounded-full px-1.5 py-0.5 bg-white/80 dark:bg-noc-bg/80 border border-gray-200/40 dark:border-noc-border/20 cursor-pointer hover:border-gray-300 dark:hover:border-noc-border/40 transition-colors"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: color }}
            />
            <span className="text-[8px] font-medium text-gray-500 dark:text-noc-text-dim">
              {rules.length}
            </span>
          </button>

          {/* Full rule card - appears on hover or when pinned */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 ${cardSide} ${isPinned ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"} transition-opacity duration-150 z-50`}
          >
            <RuleCardContent
              rules={rules}
              sourceZoneName={sourceZoneName}
              destZoneName={destZoneName}
              onLabelClick={onLabelClick}
            />
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
