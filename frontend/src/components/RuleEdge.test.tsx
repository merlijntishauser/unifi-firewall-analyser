import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RuleEdgeComponent from "./RuleEdge";
import type { EdgeProps } from "@xyflow/react";
import type { RuleEdge } from "./RuleEdge";

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  BaseEdge: ({ id, path, style }: { id: string; path: string; style: Record<string, unknown> }) => (
    <div data-testid={`edge-${id}`} data-path={path} data-stroke={style.stroke} data-stroke-width={style.strokeWidth} />
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="edge-label-renderer">{children}</div>
  ),
  getSmoothStepPath: () => ["M0,0 L100,100", 50, 50],
}));

function makeEdgeProps(overrides: Partial<EdgeProps<RuleEdge>> = {}): EdgeProps<RuleEdge> {
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
      allowCount: 0,
      blockCount: 0,
      totalRules: 0,
      onLabelClick: vi.fn(),
    },
    selected: false,
    ...overrides,
  } as unknown as EdgeProps<RuleEdge>;
}

describe("RuleEdgeComponent", () => {
  describe("edge coloring", () => {
    it("uses green color when only allows", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: { allowCount: 3, blockCount: 0, totalRules: 3 },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke", "#22c55e");
    });

    it("uses red color when only blocks", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: { allowCount: 0, blockCount: 2, totalRules: 2 },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke", "#ef4444");
    });

    it("uses amber color when mixed allows and blocks", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: { allowCount: 1, blockCount: 1, totalRules: 2 },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke", "#f59e0b");
    });

    it("uses amber color when both counts are 0", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: { allowCount: 0, blockCount: 0, totalRules: 0 },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke", "#f59e0b");
    });
  });

  describe("stroke width", () => {
    it("has strokeWidth 2 when not selected", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            selected: false,
            data: { allowCount: 1, blockCount: 0, totalRules: 1 },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke-width", "2");
    });

    it("has strokeWidth 3 when selected", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            selected: true,
            data: { allowCount: 1, blockCount: 0, totalRules: 1 },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke-width", "3");
    });
  });

  describe("label", () => {
    it("shows singular 'rule' for 1 rule", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: { allowCount: 1, blockCount: 0, totalRules: 1 },
          })}
        />,
      );
      expect(screen.getByText("1 rule")).toBeInTheDocument();
    });

    it("shows plural 'rules' for multiple rules", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: { allowCount: 2, blockCount: 1, totalRules: 3 },
          })}
        />,
      );
      expect(screen.getByText("3 rules")).toBeInTheDocument();
    });

    it("shows '0 rules' when no rules", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: { allowCount: 0, blockCount: 0, totalRules: 0 },
          })}
        />,
      );
      expect(screen.getByText("0 rules")).toBeInTheDocument();
    });

    it("calls onLabelClick when label is clicked", () => {
      const onClick = vi.fn();
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              allowCount: 1,
              blockCount: 0,
              totalRules: 1,
              onLabelClick: onClick,
            },
          })}
        />,
      );

      fireEvent.click(screen.getByText("1 rule"));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("does not throw when onLabelClick is undefined", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              allowCount: 1,
              blockCount: 0,
              totalRules: 1,
              onLabelClick: undefined,
            },
          })}
        />,
      );

      expect(() => {
        fireEvent.click(screen.getByText("1 rule"));
      }).not.toThrow();
    });
  });

  describe("handles undefined data gracefully", () => {
    it("defaults to 0 counts when data is undefined", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({ data: undefined as never })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      // 0 and 0 => amber
      expect(edge).toHaveAttribute("data-stroke", "#f59e0b");
      expect(screen.getByText("0 rules")).toBeInTheDocument();
    });
  });
});
