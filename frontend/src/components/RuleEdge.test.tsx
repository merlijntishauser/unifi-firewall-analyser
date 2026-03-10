import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RuleEdgeComponent from "./RuleEdge";
import type { EdgeProps } from "@xyflow/react";
import type { RuleEdge } from "./RuleEdge";

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  BaseEdge: ({
    id,
    path,
    style,
  }: {
    id: string;
    path: string;
    style: Record<string, unknown>;
  }) => (
    <div
      data-testid={`edge-${id}`}
      data-path={path}
      data-stroke={style.stroke}
      data-stroke-width={style.strokeWidth}
      data-stroke-dasharray={style.strokeDasharray ?? "none"}
      data-opacity={style.opacity}
    />
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="edge-label-renderer">{children}</div>
  ),
  getSmoothStepPath: () => ["M0,0 L100,100", 50, 50],
}));

function makeEdgeProps(
  overrides: Partial<EdgeProps<RuleEdge>> = {},
): EdgeProps<RuleEdge> {
  return {
    id: "edge-1",
    source: "z1",
    target: "z2",
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: "bottom" as never,
    targetPosition: "top" as never,
    data: {
      ruleName: "Allow HTTP",
      ruleIndex: 1,
      action: "ALLOW",
      protocol: "TCP",
      portRanges: ["80"],
      enabled: true,
      edgeOffset: 0,
      totalSiblings: 1,
      onLabelClick: vi.fn(),
    },
    selected: false,
    ...overrides,
  } as unknown as EdgeProps<RuleEdge>;
}

describe("RuleEdgeComponent", () => {
  describe("edge coloring by action", () => {
    it("uses green color for ALLOW action", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              ruleName: "Allow",
              ruleIndex: 1,
              action: "ALLOW",
              protocol: "TCP",
              portRanges: [],
              enabled: true,
              edgeOffset: 0,
              totalSiblings: 1,
            },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke", "#00d68f");
    });

    it("uses red color for BLOCK action", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              ruleName: "Block",
              ruleIndex: 1,
              action: "BLOCK",
              protocol: "TCP",
              portRanges: [],
              enabled: true,
              edgeOffset: 0,
              totalSiblings: 1,
            },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke", "#ff4d5e");
    });

    it("uses red color for REJECT action", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              ruleName: "Reject",
              ruleIndex: 1,
              action: "REJECT",
              protocol: "TCP",
              portRanges: [],
              enabled: true,
              edgeOffset: 0,
              totalSiblings: 1,
            },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke", "#ff4d5e");
    });
  });

  describe("stroke width", () => {
    it("has strokeWidth 2 when not selected", () => {
      render(
        <RuleEdgeComponent {...makeEdgeProps({ selected: false })} />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke-width", "2");
    });

    it("has strokeWidth 3 when selected", () => {
      render(
        <RuleEdgeComponent {...makeEdgeProps({ selected: true })} />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke-width", "3");
    });
  });

  describe("disabled rules", () => {
    it("uses dashed stroke for disabled rules", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              ruleName: "Disabled Rule",
              ruleIndex: 1,
              action: "ALLOW",
              protocol: "TCP",
              portRanges: [],
              enabled: false,
              edgeOffset: 0,
              totalSiblings: 1,
            },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke-dasharray", "6 3");
    });

    it("uses reduced opacity for disabled rules", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              ruleName: "Disabled Rule",
              ruleIndex: 1,
              action: "ALLOW",
              protocol: "TCP",
              portRanges: [],
              enabled: false,
              edgeOffset: 0,
              totalSiblings: 1,
            },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-opacity", "0.4");
    });

    it("uses solid stroke for enabled rules", () => {
      render(<RuleEdgeComponent {...makeEdgeProps()} />);
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke-dasharray", "none");
    });

    it("uses full opacity for enabled rules", () => {
      render(<RuleEdgeComponent {...makeEdgeProps()} />);
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-opacity", "1");
    });
  });

  describe("label", () => {
    it("shows rule name", () => {
      render(<RuleEdgeComponent {...makeEdgeProps()} />);
      expect(screen.getByText("Allow HTTP")).toBeInTheDocument();
    });

    it("shows protocol and port when present", () => {
      render(<RuleEdgeComponent {...makeEdgeProps()} />);
      expect(screen.getByText("TCP:80")).toBeInTheDocument();
    });

    it("shows protocol and multiple ports", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              ruleName: "Multi",
              ruleIndex: 1,
              action: "ALLOW",
              protocol: "TCP",
              portRanges: ["80", "443"],
              enabled: true,
              edgeOffset: 0,
              totalSiblings: 1,
            },
          })}
        />,
      );
      expect(screen.getByText("TCP:80,443")).toBeInTheDocument();
    });

    it("shows only protocol when no ports", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              ruleName: "ICMP Rule",
              ruleIndex: 1,
              action: "ALLOW",
              protocol: "ICMP",
              portRanges: [],
              enabled: true,
              edgeOffset: 0,
              totalSiblings: 1,
            },
          })}
        />,
      );
      expect(screen.getByText("ICMP")).toBeInTheDocument();
    });

    it("does not show port label when no protocol", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              ruleName: "Any Rule",
              ruleIndex: 1,
              action: "ALLOW",
              protocol: "",
              portRanges: [],
              enabled: true,
              edgeOffset: 0,
              totalSiblings: 1,
            },
          })}
        />,
      );
      expect(screen.getByText("Any Rule")).toBeInTheDocument();
      // Only the rule name span should be present
      const labelRenderer = screen.getByTestId("edge-label-renderer");
      const spans = labelRenderer.querySelectorAll("span");
      expect(spans.length).toBe(1);
    });

    it("calls onLabelClick when label is clicked", () => {
      const onClick = vi.fn();
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              ruleName: "Click Me",
              ruleIndex: 1,
              action: "ALLOW",
              protocol: "TCP",
              portRanges: [],
              enabled: true,
              edgeOffset: 0,
              totalSiblings: 1,
              onLabelClick: onClick,
            },
          })}
        />,
      );

      fireEvent.click(screen.getByText("Click Me"));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("does not throw when onLabelClick is undefined", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              ruleName: "No Click",
              ruleIndex: 1,
              action: "ALLOW",
              protocol: "TCP",
              portRanges: [],
              enabled: true,
              edgeOffset: 0,
              totalSiblings: 1,
              onLabelClick: undefined,
            },
          })}
        />,
      );

      expect(() => {
        fireEvent.click(screen.getByText("No Click"));
      }).not.toThrow();
    });
  });

  describe("handles undefined data gracefully", () => {
    it("defaults to ALLOW color when data is undefined", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({ data: undefined as never })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke", "#00d68f");
    });
  });
});
