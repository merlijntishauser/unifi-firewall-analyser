import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import { getActionColor } from "../utils/edgeColor";

export interface RuleEdgeData {
  ruleName: string;
  ruleIndex: number;
  action: string;
  protocol: string;
  portRanges: string[];
  enabled: boolean;
  edgeOffset: number;
  totalSiblings: number;
  onLabelClick?: () => void;
  [key: string]: unknown;
}

export type RuleEdge = Edge<RuleEdgeData, "rule">;

const EDGE_SPACING = 25;

const DATA_DEFAULTS: Omit<RuleEdgeData, "onLabelClick"> = {
  ruleName: "",
  ruleIndex: 0,
  action: "ALLOW",
  protocol: "",
  portRanges: [],
  enabled: true,
  edgeOffset: 0,
  totalSiblings: 1,
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
}: EdgeProps<RuleEdge>) {
  const { edgeOffset, totalSiblings, action, enabled, ruleName, protocol, portRanges, onLabelClick } = resolveData(data);
  const xOffset = (edgeOffset - (totalSiblings - 1) / 2) * EDGE_SPACING;
  const color = getActionColor(action);
  const portLabel = formatPortLabel(protocol, portRanges);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: sourceX + xOffset,
    sourceY,
    sourcePosition,
    targetX: targetX + xOffset,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: enabled ? undefined : "6 3",
          opacity: enabled ? 1 : 0.4,
        }}
      />
      <EdgeLabelRenderer>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLabelClick?.();
          }}
          className="nopan nodrag"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            background: "#13161e",
            border: `1px solid ${color}40`,
            borderLeft: `3px solid ${color}`,
            borderRadius: "6px",
            padding: "3px 8px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "1px",
            opacity: enabled ? 1 : 0.5,
            minWidth: "60px",
          }}
        >
          <span
            style={{
              fontSize: "10px",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              color: "#e4e8ef",
              whiteSpace: "nowrap",
              letterSpacing: "0.01em",
            }}
          >
            {ruleName}
          </span>
          {portLabel && (
            <span
              style={{
                fontSize: "9px",
                fontFamily: "var(--font-mono)",
                fontWeight: 400,
                color: "#7b8ba2",
                whiteSpace: "nowrap",
              }}
            >
              {portLabel}
            </span>
          )}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
