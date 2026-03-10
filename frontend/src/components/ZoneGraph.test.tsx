import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ZoneGraph from "./ZoneGraph";
import type { Zone, ZonePair } from "../api/types";

// Mock @xyflow/react completely since ReactFlow does not work in jsdom
const mockSetNodes = vi.fn();
const mockSetEdges = vi.fn();
let capturedOnEdgeClick: ((event: unknown, edge: { source: string; target: string }) => void) | null = null;

vi.mock("@xyflow/react", () => {
  return {
    ReactFlow: ({ nodes, edges, onEdgeClick, colorMode, children }: {
      nodes: unknown[];
      edges: Array<{ id: string; source: string; target: string; data?: { onLabelClick?: () => void } }>;
      onEdgeClick: (event: unknown, edge: { source: string; target: string }) => void;
      colorMode: string;
      children: React.ReactNode;
    }) => {
      capturedOnEdgeClick = onEdgeClick;
      return (
        <div data-testid="react-flow" data-color-mode={colorMode}>
          <div data-testid="nodes-count">{Array.isArray(nodes) ? nodes.length : 0}</div>
          <div data-testid="edges-count">{Array.isArray(edges) ? edges.length : 0}</div>
          {Array.isArray(edges) && edges.map((edge) => (
            <button
              key={edge.id}
              data-testid={`edge-${edge.id}`}
              onClick={(e) => onEdgeClick?.(e, edge)}
            >
              {edge.id}
            </button>
          ))}
          {Array.isArray(edges) && edges.map((edge) => (
            edge.data?.onLabelClick ? (
              <button
                key={`label-${edge.id}`}
                data-testid={`edge-label-${edge.id}`}
                onClick={() => edge.data?.onLabelClick?.()}
              >
                label {edge.id}
              </button>
            ) : null
          ))}
          {children}
        </div>
      );
    },
    Background: () => <div data-testid="background" />,
    Controls: () => <div data-testid="controls" />,
    MiniMap: () => <div data-testid="minimap" />,
    useNodesState: (initial: unknown[]) => [initial, mockSetNodes, vi.fn()],
    useEdgesState: (initial: unknown[]) => [initial, mockSetEdges, vi.fn()],
  };
});

// Mock the layout utility
vi.mock("../utils/layout", () => ({
  getLayoutedElements: (nodes: unknown[], edges: unknown[]) => ({ nodes, edges }),
}));

// Mock child components
vi.mock("./ZoneNode", () => ({
  default: () => <div>ZoneNode</div>,
}));

vi.mock("./RuleEdge", () => ({
  default: () => <div>RuleEdge</div>,
}));

describe("ZoneGraph", () => {
  const zones: Zone[] = [
    { id: "z1", name: "External", networks: [] },
    { id: "z2", name: "Internal", networks: [{ id: "n1", name: "LAN", vlan_id: 1, subnet: "10.0.0.0/24" }] },
  ];

  const zonePairs: ZonePair[] = [
    {
      source_zone_id: "z1",
      destination_zone_id: "z2",
      rules: [
        {
          id: "r1",
          name: "Allow HTTP",
          description: "",
          enabled: true,
          action: "ALLOW",
          source_zone_id: "z1",
          destination_zone_id: "z2",
          protocol: "TCP",
          port_ranges: ["80"],
          ip_ranges: [],
          index: 1,
          predefined: false,
        },
      ],
      allow_count: 1,
      block_count: 0,
      analysis: { score: 85, grade: "B", findings: [] },
    },
  ];

  const onEdgeSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnEdgeClick = null;
  });

  it("renders ReactFlow with correct number of nodes", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );
    expect(screen.getByTestId("nodes-count").textContent).toBe("2");
  });

  it("renders ReactFlow with correct number of edges", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );
    expect(screen.getByTestId("edges-count").textContent).toBe("1");
  });

  it("passes colorMode to ReactFlow", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="dark" onEdgeSelect={onEdgeSelect} />,
    );
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-color-mode", "dark");
  });

  it("renders Background, Controls, and MiniMap", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );
    expect(screen.getByTestId("background")).toBeInTheDocument();
    expect(screen.getByTestId("controls")).toBeInTheDocument();
    expect(screen.getByTestId("minimap")).toBeInTheDocument();
  });

  it("calls onEdgeSelect when edge is clicked and pair is found", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );

    fireEvent.click(screen.getByTestId("edge-z1->z2"));
    expect(onEdgeSelect).toHaveBeenCalledWith(zonePairs[0]);
  });

  it("calls onEdgeSelect via onLabelClick (buildElements callback)", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );

    // Click the edge label button which triggers onLabelClick from buildElements
    fireEvent.click(screen.getByTestId("edge-label-z1->z2"));
    expect(onEdgeSelect).toHaveBeenCalledWith(zonePairs[0]);
  });

  it("does not call onEdgeSelect when clicked edge does not match any zone pair", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={zonePairs} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );

    // Simulate clicking an edge with source/target that doesn't match any zone pair
    capturedOnEdgeClick!({}, { source: "z999", target: "z888" });
    expect(onEdgeSelect).not.toHaveBeenCalled();
  });

  it("handles empty zone pairs gracefully", () => {
    render(
      <ZoneGraph zones={zones} zonePairs={[]} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );

    // With empty zone pairs, no edges exist to click
    expect(onEdgeSelect).not.toHaveBeenCalled();
  });

  it("handles empty zones and zone pairs", () => {
    render(
      <ZoneGraph zones={[]} zonePairs={[]} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );
    expect(screen.getByTestId("nodes-count").textContent).toBe("0");
    expect(screen.getByTestId("edges-count").textContent).toBe("0");
  });

  it("filters to only connected zones when focusZoneIds has one ID", () => {
    const threeZones: Zone[] = [
      { id: "z1", name: "External", networks: [] },
      { id: "z2", name: "Internal", networks: [] },
      { id: "z3", name: "Guest", networks: [] },
    ];
    const pairs: ZonePair[] = [
      {
        source_zone_id: "z1", destination_zone_id: "z2",
        rules: [{ id: "r1", name: "R1", description: "", enabled: true, action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 1, predefined: false }],
        allow_count: 1, block_count: 0, analysis: null,
      },
      {
        source_zone_id: "z2", destination_zone_id: "z3",
        rules: [{ id: "r2", name: "R2", description: "", enabled: true, action: "BLOCK", source_zone_id: "z2", destination_zone_id: "z3", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 2, predefined: false }],
        allow_count: 0, block_count: 1, analysis: null,
      },
    ];

    render(
      <ZoneGraph zones={threeZones} zonePairs={pairs} colorMode="light" onEdgeSelect={onEdgeSelect} focusZoneIds={["z1"]} />,
    );
    // z1 connects to z2 only, so we should see 2 nodes (z1, z2) and 1 edge
    expect(screen.getByTestId("nodes-count").textContent).toBe("2");
    expect(screen.getByTestId("edges-count").textContent).toBe("1");
  });

  it("filters to exact pair when focusZoneIds has two IDs", () => {
    const threeZones: Zone[] = [
      { id: "z1", name: "External", networks: [] },
      { id: "z2", name: "Internal", networks: [] },
      { id: "z3", name: "Guest", networks: [] },
    ];
    const pairs: ZonePair[] = [
      {
        source_zone_id: "z1", destination_zone_id: "z2",
        rules: [{ id: "r1", name: "R1", description: "", enabled: true, action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 1, predefined: false }],
        allow_count: 1, block_count: 0, analysis: null,
      },
      {
        source_zone_id: "z1", destination_zone_id: "z3",
        rules: [{ id: "r2", name: "R2", description: "", enabled: true, action: "BLOCK", source_zone_id: "z1", destination_zone_id: "z3", protocol: "TCP", port_ranges: [], ip_ranges: [], index: 2, predefined: false }],
        allow_count: 0, block_count: 1, analysis: null,
      },
    ];

    render(
      <ZoneGraph zones={threeZones} zonePairs={pairs} colorMode="light" onEdgeSelect={onEdgeSelect} focusZoneIds={["z1", "z2"]} />,
    );
    // Only z1->z2 pair, so 2 nodes and 1 edge (z1->z3 excluded)
    expect(screen.getByTestId("nodes-count").textContent).toBe("2");
    expect(screen.getByTestId("edges-count").textContent).toBe("1");
  });

  it("shows all zones when focusZoneIds is not set", () => {
    const threeZones: Zone[] = [
      { id: "z1", name: "External", networks: [] },
      { id: "z2", name: "Internal", networks: [] },
      { id: "z3", name: "Guest", networks: [] },
    ];

    render(
      <ZoneGraph zones={threeZones} zonePairs={[]} colorMode="light" onEdgeSelect={onEdgeSelect} />,
    );
    expect(screen.getByTestId("nodes-count").textContent).toBe("3");
  });
});
