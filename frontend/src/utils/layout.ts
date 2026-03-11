import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 100;

/** Usable horizontal spread on each side of the node (pixels from center). */
const SPREAD_HALF = NODE_WIDTH * 0.35; // 77px each side → 154px total

/**
 * Compute pixel offsets so outgoing/incoming edges fan out across the
 * bottom/top of each node instead of overlapping on the center handle.
 *
 * Returns maps from edge-id to pixel offset (relative to node center).
 */
function computeEdgeOffsets(
  edges: Edge[],
  posMap: Map<string, { x: number; y: number }>,
): { sourceOffsets: Map<string, number>; targetOffsets: Map<string, number> } {
  const outgoing = new Map<string, Edge[]>();
  const incoming = new Map<string, Edge[]>();

  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source)!.push(edge);
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    incoming.get(edge.target)!.push(edge);
  }

  const sourceOffsets = new Map<string, number>();
  const targetOffsets = new Map<string, number>();

  for (const [, nodeEdges] of outgoing) {
    const sorted = [...nodeEdges].sort(
      (a, b) => posMap.get(a.target)!.x - posMap.get(b.target)!.x,
    );
    const n = sorted.length;
    for (let i = 0; i < n; i++) {
      const offset = n === 1 ? 0 : -SPREAD_HALF + (i * 2 * SPREAD_HALF) / (n - 1);
      sourceOffsets.set(sorted[i].id, offset);
    }
  }

  for (const [, nodeEdges] of incoming) {
    const sorted = [...nodeEdges].sort(
      (a, b) => posMap.get(a.source)!.x - posMap.get(b.source)!.x,
    );
    const n = sorted.length;
    for (let i = 0; i < n; i++) {
      const offset = n === 1 ? 0 : -SPREAD_HALF + (i * 2 * SPREAD_HALF) / (n - 1);
      targetOffsets.set(sorted[i].id, offset);
    }
  }

  return { sourceOffsets, targetOffsets };
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph({ multigraph: true }).setDefaultEdgeLabel(
    () => ({}),
  );
  g.setGraph({ rankdir: "TB", ranksep: 300, nodesep: 100 });

  nodes.forEach((node) =>
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }),
  );
  edges.forEach((edge) => g.setEdge(edge.source, edge.target, {}, edge.id));
  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });

  const posMap = new Map(layoutedNodes.map((n) => [n.id, n.position]));
  const { sourceOffsets, targetOffsets } = computeEdgeOffsets(edges, posMap);

  const layoutedEdges = edges.map((edge) => ({
    ...edge,
    data: {
      ...edge.data,
      sourceXOffset: sourceOffsets.get(edge.id) ?? 0,
      targetXOffset: targetOffsets.get(edge.id) ?? 0,
    },
  }));

  return { nodes: layoutedNodes, edges: layoutedEdges };
}
