import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ColorMode,
} from "@xyflow/react";
import type { Zone, ZonePair } from "../api/types";
import { getLayoutedElements } from "../utils/layout";
import ZoneNodeComponent, { type ZoneNodeData } from "./ZoneNode";
import RuleEdgeComponent, { type RuleEdgeData } from "./RuleEdge";

const nodeTypes = { zone: ZoneNodeComponent };
const edgeTypes = { rule: RuleEdgeComponent };

interface ZoneGraphProps {
  zones: Zone[];
  zonePairs: ZonePair[];
  colorMode: ColorMode;
  onEdgeSelect: (pair: ZonePair) => void;
}

function buildElements(
  zones: Zone[],
  zonePairs: ZonePair[],
  onEdgeSelect: (pair: ZonePair) => void,
) {
  const rawNodes: Node<ZoneNodeData>[] = zones.map((zone) => ({
    id: zone.id,
    type: "zone" as const,
    position: { x: 0, y: 0 },
    data: {
      label: zone.name,
      networks: zone.networks,
    },
  }));

  const rawEdges: Edge<RuleEdgeData>[] = zonePairs.map((pair) => ({
    id: `${pair.source_zone_id}->${pair.destination_zone_id}`,
    source: pair.source_zone_id,
    target: pair.destination_zone_id,
    type: "rule" as const,
    data: {
      allowCount: pair.allow_count,
      blockCount: pair.block_count,
      totalRules: pair.rules.length,
      onLabelClick: () => onEdgeSelect(pair),
    },
  }));

  return getLayoutedElements(rawNodes, rawEdges);
}

export default function ZoneGraph({
  zones,
  zonePairs,
  colorMode,
  onEdgeSelect,
}: ZoneGraphProps) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => buildElements(zones, zonePairs, onEdgeSelect),
    [zones, zonePairs, onEdgeSelect],
  );

  const [nodes, , onNodesChange] = useNodesState(layoutedNodes);
  const [edges, , onEdgesChange] = useEdgesState(layoutedEdges);

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const pair = zonePairs.find(
        (zp) =>
          zp.source_zone_id === edge.source &&
          zp.destination_zone_id === edge.target,
      );
      if (pair) {
        onEdgeSelect(pair);
      }
    },
    [zonePairs, onEdgeSelect],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onEdgeClick={handleEdgeClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      colorMode={colorMode}
      fitView
      minZoom={0.3}
      maxZoom={2}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
