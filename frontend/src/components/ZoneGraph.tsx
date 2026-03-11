import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ColorMode,
} from "@xyflow/react";
import type { Zone, ZonePair } from "../api/types";
import { getLayoutedElements } from "../utils/layout";
import { getEdgeColor } from "../utils/edgeColor";
import ZoneNodeComponent, { type ZoneNodeData } from "./ZoneNode";
import RuleEdgeComponent, { type RuleEdgeData } from "./RuleEdge";

const nodeTypes = { zone: ZoneNodeComponent };
const edgeTypes = { rule: RuleEdgeComponent };

interface ZoneGraphProps {
  zones: Zone[];
  zonePairs: ZonePair[];
  colorMode: ColorMode;
  onEdgeSelect: (pair: ZonePair) => void;
  focusZoneIds?: string[];
}

function buildElements(
  zones: Zone[],
  zonePairs: ZonePair[],
  onEdgeSelect: (pair: ZonePair) => void,
  focusZoneIds?: string[],
) {
  let filteredZones = zones;
  let filteredPairs = zonePairs;

  if (focusZoneIds && focusZoneIds.length === 2) {
    const [a, b] = focusZoneIds;
    filteredPairs = zonePairs.filter(
      (p) =>
        (p.source_zone_id === a && p.destination_zone_id === b) ||
        (p.source_zone_id === b && p.destination_zone_id === a),
    );
    const pairIds = new Set(focusZoneIds);
    filteredZones = zones.filter((z) => pairIds.has(z.id));
  } else if (focusZoneIds && focusZoneIds.length === 1) {
    const focusId = focusZoneIds[0];
    filteredPairs = zonePairs.filter(
      (p) => p.source_zone_id === focusId || p.destination_zone_id === focusId,
    );
    const connectedIds = new Set<string>();
    connectedIds.add(focusId);
    for (const p of filteredPairs) {
      connectedIds.add(p.source_zone_id);
      connectedIds.add(p.destination_zone_id);
    }
    filteredZones = zones.filter((z) => connectedIds.has(z.id));
  }

  const rawNodes: Node<ZoneNodeData>[] = filteredZones.map((zone) => ({
    id: zone.id,
    type: "zone" as const,
    position: { x: 0, y: 0 },
    data: {
      label: zone.name,
      networks: zone.networks,
    },
  }));

  // Detect bidirectional pairs for edge offset
  const pairKeys = new Set(
    filteredPairs.map((p) => `${p.source_zone_id}|${p.destination_zone_id}`),
  );

  const zoneNameMap = new Map(zones.map((z) => [z.id, z.name]));

  const nodeCount = rawNodes.length;

  const rawEdges: Edge<RuleEdgeData>[] = filteredPairs.map((pair) => {
    const reverseKey = `${pair.destination_zone_id}|${pair.source_zone_id}`;
    const isBidirectional = pairKeys.has(reverseKey);

    let edgeOffset = 0;
    if (isBidirectional) {
      edgeOffset =
        pair.source_zone_id < pair.destination_zone_id ? -1 : 1;
    }

    const color = getEdgeColor(pair.allow_count, pair.block_count);
    return {
      id: `${pair.source_zone_id}->${pair.destination_zone_id}`,
      source: pair.source_zone_id,
      target: pair.destination_zone_id,
      type: "rule" as const,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
        width: 20,
        height: 20,
      },
      data: {
        rules: pair.rules.map((r) => ({
          name: r.name,
          action: r.action,
          protocol: r.protocol,
          portRanges: r.port_ranges,
          enabled: r.enabled,
        })),
        allowCount: pair.allow_count,
        blockCount: pair.block_count,
        edgeOffset,
        nodeCount,
        sourceZoneName: zoneNameMap.get(pair.source_zone_id) ?? "",
        destZoneName: zoneNameMap.get(pair.destination_zone_id) ?? "",
        onLabelClick: () => onEdgeSelect(pair),
      },
    };
  });

  return getLayoutedElements(rawNodes, rawEdges);
}

export default function ZoneGraph({
  zones,
  zonePairs,
  colorMode,
  onEdgeSelect,
  focusZoneIds,
}: ZoneGraphProps) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => buildElements(zones, zonePairs, onEdgeSelect, focusZoneIds),
    [zones, zonePairs, onEdgeSelect, focusZoneIds],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

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
