import { describe, it, expect, vi } from "vitest";
import type { Node, Edge } from "@xyflow/react";

// Mock dagre since its ESM interop doesn't work cleanly in vitest jsdom
vi.mock("@dagrejs/dagre", () => {
  class Graph {
    private nodes: Map<string, Record<string, number>> = new Map();
    private edges: Array<{ source: string; target: string }> = [];
    private graphConfig: Record<string, unknown> = {};
    private counter = 0;

    setDefaultEdgeLabel(fn: () => Record<string, unknown>) {
      fn(); // exercise the callback
      return this;
    }

    setGraph(config: Record<string, unknown>) {
      this.graphConfig = config;
    }

    setNode(id: string, dims: { width: number; height: number }) {
      this.nodes.set(id, { width: dims.width, height: dims.height, x: 0, y: 0 });
    }

    setEdge(source: string, target: string) {
      this.edges.push({ source, target });
    }

    node(id: string) {
      return this.nodes.get(id)!;
    }

    layoutNodes() {
      // Simple top-to-bottom layout: position nodes based on topological order
      const rank = new Map<string, number>();

      // Assign ranks based on edges (simple BFS from sources)
      for (const [id] of this.nodes) {
        if (!rank.has(id)) rank.set(id, 0);
      }
      for (const edge of this.edges) {
        const srcRank = rank.get(edge.source) ?? 0;
        rank.set(edge.target, Math.max(rank.get(edge.target) ?? 0, srcRank + 1));
      }

      // Sort by rank and assign positions
      const sorted = [...this.nodes.keys()].sort(
        (a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0),
      );

      for (const id of sorted) {
        const r = rank.get(id) ?? 0;
        const nodeData = this.nodes.get(id)!;
        nodeData.x = nodeData.width / 2;
        nodeData.y = r * 220 + nodeData.height / 2;
      }
    }
  }

  const mod = {
    graphlib: { Graph },
    layout: (g: Graph) => {
      (g as unknown as { layoutNodes: () => void }).layoutNodes();
    },
  };
  return { default: mod, ...mod };
});

import { getLayoutedElements } from "./layout";

describe("getLayoutedElements", () => {
  it("returns positioned nodes and the same edges", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [{ id: "e1", source: "a", target: "b" }];

    const result = getLayoutedElements(nodes, edges);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toBe(edges);

    for (const node of result.nodes) {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe("number");
      expect(typeof node.position.y).toBe("number");
    }
  });

  it("positions nodes differently when there are edges between them", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [{ id: "e1", source: "a", target: "b" }];

    const result = getLayoutedElements(nodes, edges);

    const nodeA = result.nodes.find((n) => n.id === "a")!;
    const nodeB = result.nodes.find((n) => n.id === "b")!;

    // With TB layout, nodeA should be above nodeB (smaller y)
    expect(nodeA.position.y).toBeLessThan(nodeB.position.y);
  });

  it("handles empty inputs", () => {
    const result = getLayoutedElements([], []);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("handles nodes with no edges", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 0 }, data: {} },
    ];

    const result = getLayoutedElements(nodes, []);
    expect(result.nodes).toHaveLength(2);
    for (const node of result.nodes) {
      expect(node.position).toBeDefined();
    }
  });

  it("preserves extra node data after layout", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: { label: "Zone A" }, type: "zone" },
    ];
    const edges: Edge[] = [];

    const result = getLayoutedElements(nodes, edges);
    expect(result.nodes[0].data).toEqual({ label: "Zone A" });
    expect(result.nodes[0].type).toBe("zone");
    expect(result.nodes[0].id).toBe("a");
  });

  it("handles a three-node chain", () => {
    const nodes: Node[] = [
      { id: "a", position: { x: 0, y: 0 }, data: {} },
      { id: "b", position: { x: 0, y: 0 }, data: {} },
      { id: "c", position: { x: 0, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "c" },
    ];

    const result = getLayoutedElements(nodes, edges);
    const [a, b, c] = ["a", "b", "c"].map((id) => result.nodes.find((n) => n.id === id)!);

    expect(a.position.y).toBeLessThan(b.position.y);
    expect(b.position.y).toBeLessThan(c.position.y);
  });
});
