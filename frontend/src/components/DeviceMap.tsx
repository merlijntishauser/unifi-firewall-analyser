import { useMemo } from "react";
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
import dagre from "@dagrejs/dagre";
import type { TopologyDevice, TopologyEdge } from "../api/types";
import DeviceNodeComponent, { type DeviceNodeData } from "./DeviceNode";

interface DeviceMapProps {
  devices: TopologyDevice[];
  edges: TopologyEdge[];
  colorMode: ColorMode;
  onDeviceSelect: (device: TopologyDevice) => void;
}

const nodeTypes = { device: DeviceNodeComponent };

const NODE_WIDTH = 200;
const NODE_HEIGHT = 120;

/** Rank order for device types: gateways at top, switches in middle, APs at bottom. */
const DEVICE_RANK: Record<string, number> = {
  ugw: 0,
  udm: 0,
  usw: 1,
  uap: 2,
};

function getDeviceRank(type: string): number {
  return DEVICE_RANK[type] ?? 1;
}

function formatEdgeSpeed(speed: number | null): string {
  if (speed === null || speed === 0) return "";
  if (speed === 1000) return "1G";
  if (speed === 2500) return "2.5G";
  if (speed === 10000) return "10G";
  return `${speed}M`;
}

function layoutDevices(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 120, nodesep: 80 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function buildElements(
  devices: TopologyDevice[],
  topologyEdges: TopologyEdge[],
  onDeviceSelect: (device: TopologyDevice) => void,
): { nodes: Node<DeviceNodeData>[]; edges: Edge[] } {
  const deviceByMac = new Map(devices.map((d) => [d.mac, d]));

  // Sort devices by rank so dagre respects the layering
  const sortedDevices = [...devices].sort(
    (a, b) => getDeviceRank(a.type) - getDeviceRank(b.type),
  );

  const nodes: Node<DeviceNodeData>[] = sortedDevices.map((device) => ({
    id: device.mac,
    type: "device" as const,
    position: { x: 0, y: 0 },
    data: {
      label: device.name,
      deviceType: device.type === "ugw" || device.type === "udm" ? "gateway"
        : device.type === "usw" ? "switch"
        : device.type === "uap" ? "ap"
        : "other",
      model: device.model_name,
      ip: device.ip,
      status: device.status,
      clientCount: device.client_count,
      onSelect: () => onDeviceSelect(device),
    },
  }));

  const edges: Edge[] = topologyEdges.map((te, idx) => {
    const speed = formatEdgeSpeed(te.speed);
    const label = [speed, te.poe ? "PoE" : ""].filter(Boolean).join(" / ");
    return {
      id: `edge-${idx}`,
      source: te.from_mac,
      target: te.to_mac,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
      },
      label: label || undefined,
      labelStyle: { fontSize: 10, fill: "#7b8ba2" },
      style: { stroke: te.wireless ? "#006fff" : "#4a5468" },
    };
  }).filter((e) => deviceByMac.has(e.source) && deviceByMac.has(e.target));

  return layoutDevices(nodes, edges);
}

function DeviceMapInner({
  initialNodes,
  initialEdges,
  colorMode,
}: {
  initialNodes: Node[];
  initialEdges: Edge[];
  colorMode: ColorMode;
}) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <ReactFlow
      id="topology-map"
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
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

export default function DeviceMap({ devices, edges: topologyEdges, colorMode, onDeviceSelect }: DeviceMapProps) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => buildElements(devices, topologyEdges, onDeviceSelect),
    [devices, topologyEdges, onDeviceSelect],
  );

  const layoutKey = layoutedNodes.map((n) => n.id).join(",") + "|" + layoutedEdges.map((e) => e.id).join(",");

  return (
    <DeviceMapInner
      key={layoutKey}
      initialNodes={layoutedNodes}
      initialEdges={layoutedEdges}
      colorMode={colorMode}
    />
  );
}
