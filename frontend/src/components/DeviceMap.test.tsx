import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DeviceMap from "./DeviceMap";
import type { TopologyDevice, TopologyEdge } from "../api/types";

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ nodes, edges }: { nodes: Array<{ id: string }>; edges: Array<{ id: string }> }) => (
    <div data-testid="react-flow">
      <div data-testid="nodes-count">{nodes.length}</div>
      <div data-testid="edges-count">{edges.length}</div>
    </div>
  ),
  Background: () => <div />,
  Controls: () => <div />,
  MiniMap: () => <div />,
  Handle: () => <div />,
  Position: { Top: "top", Bottom: "bottom" },
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  MarkerType: { ArrowClosed: "arrowclosed" },
}));

vi.mock("@dagrejs/dagre", () => {
  class MockGraph {
    _nodes: Record<string, { x: number; y: number }> = {};
    setDefaultEdgeLabel() { return this; }
    setGraph = vi.fn();
    setNode(_id: string) { this._nodes[_id] = { x: 100, y: 100 }; }
    setEdge = vi.fn();
    node(id: string) { return this._nodes[id] ?? { x: 100, y: 100 }; }
  }
  return {
    default: {
      graphlib: { Graph: MockGraph },
      layout: vi.fn(),
    },
  };
});

const testDevices: TopologyDevice[] = [
  { mac: "aa:01", name: "Gateway", model: "UDM", model_name: "UDM", type: "gateway", ip: "10.0.0.1", version: "4.0", uptime: 0, status: "online", client_count: 5, ports: [] },
  { mac: "aa:02", name: "Switch", model: "USW", model_name: "USW", type: "switch", ip: "10.0.0.2", version: "7.0", uptime: 0, status: "online", client_count: 10, ports: [] },
];

const testEdges: TopologyEdge[] = [
  { from_mac: "aa:01", to_mac: "aa:02", speed: 1000, poe: false, wireless: false, local_port: null, remote_port: null },
];

describe("DeviceMap", () => {
  it("renders ReactFlow with correct node count", () => {
    render(<DeviceMap devices={testDevices} edges={testEdges} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(screen.getByTestId("nodes-count").textContent).toBe("2");
  });

  it("renders ReactFlow with correct edge count", () => {
    render(<DeviceMap devices={testDevices} edges={testEdges} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(screen.getByTestId("edges-count").textContent).toBe("1");
  });

  it("renders with empty data", () => {
    render(<DeviceMap devices={[]} edges={[]} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(screen.getByTestId("nodes-count").textContent).toBe("0");
  });

  it("renders edges with various speeds", () => {
    const edgesWithSpeeds: TopologyEdge[] = [
      { from_mac: "aa:01", to_mac: "aa:02", speed: 1000, poe: false, wireless: false, local_port: null, remote_port: null },
      { from_mac: "aa:02", to_mac: "aa:01", speed: 2500, poe: true, wireless: false, local_port: null, remote_port: null },
      { from_mac: "aa:01", to_mac: "aa:02", speed: 10000, poe: false, wireless: false, local_port: null, remote_port: null },
      { from_mac: "aa:02", to_mac: "aa:01", speed: 100, poe: false, wireless: false, local_port: null, remote_port: null },
      { from_mac: "aa:01", to_mac: "aa:02", speed: null, poe: false, wireless: false, local_port: null, remote_port: null },
    ];
    render(<DeviceMap devices={testDevices} edges={edgesWithSpeeds} colorMode="dark" onDeviceSelect={vi.fn()} />);
    expect(screen.getByTestId("edges-count").textContent).toBe("5");
  });

  it("renders with AP device type", () => {
    const apDevice: TopologyDevice = { mac: "aa:03", name: "AP", model: "UAP", model_name: "UAP", type: "uap", ip: "10.0.0.3", version: "7.0", uptime: 0, status: "online", client_count: 20, ports: [] };
    render(<DeviceMap devices={[...testDevices, apDevice]} edges={testEdges} colorMode="light" onDeviceSelect={vi.fn()} />);
    expect(screen.getByTestId("nodes-count").textContent).toBe("3");
  });
});
