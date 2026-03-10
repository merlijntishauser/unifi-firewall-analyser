import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RuleEdgeComponent from "./RuleEdge";
import type { EdgeProps } from "@xyflow/react";
import type { RuleEdge, RuleSummary } from "./RuleEdge";

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  BaseEdge: ({
    id,
    path,
    style,
    markerEnd,
  }: {
    id: string;
    path: string;
    style: Record<string, unknown>;
    markerEnd?: string;
  }) => (
    <div
      data-testid={`edge-${id}`}
      data-path={path}
      data-stroke={style.stroke}
      data-stroke-width={style.strokeWidth}
      data-marker-end={markerEnd ?? "none"}
    />
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="edge-label-renderer">{children}</div>
  ),
  getSmoothStepPath: () => ["M0,0 L100,100", 50, 50],
  Position: { Left: "left", Top: "top", Right: "right", Bottom: "bottom" },
}));

const allowRule: RuleSummary = {
  name: "Allow HTTP",
  action: "ALLOW",
  protocol: "TCP",
  portRanges: ["80"],
  enabled: true,
};

const blockRule: RuleSummary = {
  name: "Block SSH",
  action: "BLOCK",
  protocol: "TCP",
  portRanges: ["22"],
  enabled: true,
};

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
      rules: [allowRule],
      allowCount: 1,
      blockCount: 0,
      onLabelClick: vi.fn(),
    },
    markerEnd: "url(#arrow)",
    selected: false,
    ...overrides,
  } as unknown as EdgeProps<RuleEdge>;
}

describe("RuleEdgeComponent", () => {
  describe("arrowhead", () => {
    it("passes markerEnd to BaseEdge", () => {
      render(<RuleEdgeComponent {...makeEdgeProps()} />);
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-marker-end", "url(#arrow)");
    });
  });

  describe("edge coloring by allow/block ratio", () => {
    it("uses green color when only allows", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: { rules: [allowRule], allowCount: 1, blockCount: 0 },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke", "#00d68f");
    });

    it("uses red color when only blocks", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: { rules: [blockRule], allowCount: 0, blockCount: 1 },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke", "#ff4d5e");
    });

    it("uses amber color when mixed", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              rules: [allowRule, blockRule],
              allowCount: 1,
              blockCount: 1,
            },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke", "#ffaa2c");
    });

    it("uses amber color when both counts are 0", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: { rules: [], allowCount: 0, blockCount: 0 },
          })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke", "#ffaa2c");
    });
  });

  describe("stroke width", () => {
    it("has strokeWidth 2 when not selected", () => {
      render(<RuleEdgeComponent {...makeEdgeProps({ selected: false })} />);
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke-width", "2");
    });

    it("has strokeWidth 3 when selected", () => {
      render(<RuleEdgeComponent {...makeEdgeProps({ selected: true })} />);
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke-width", "3");
    });
  });

  describe("rule list display", () => {
    it("shows rule names", () => {
      render(<RuleEdgeComponent {...makeEdgeProps()} />);
      expect(screen.getByText("Allow HTTP")).toBeInTheDocument();
    });

    it("shows protocol and port", () => {
      render(<RuleEdgeComponent {...makeEdgeProps()} />);
      expect(screen.getByText("TCP:80")).toBeInTheDocument();
    });

    it("shows multiple rules", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              rules: [allowRule, blockRule],
              allowCount: 1,
              blockCount: 1,
            },
          })}
        />,
      );
      expect(screen.getByText("Allow HTTP")).toBeInTheDocument();
      expect(screen.getByText("Block SSH")).toBeInTheDocument();
    });

    it("shows only protocol when no ports", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              rules: [
                { name: "ICMP Rule", action: "ALLOW", protocol: "ICMP", portRanges: [], enabled: true },
              ],
              allowCount: 1,
              blockCount: 0,
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
              rules: [
                { name: "Any Rule", action: "ALLOW", protocol: "", portRanges: [], enabled: true },
              ],
              allowCount: 1,
              blockCount: 0,
            },
          })}
        />,
      );
      expect(screen.getByText("Any Rule")).toBeInTheDocument();
      const labelRenderer = screen.getByTestId("edge-label-renderer");
      const monoSpans = labelRenderer.querySelectorAll(".font-mono");
      expect(monoSpans.length).toBe(0);
    });

    it("shows 'No active rules' when rules array is empty", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: { rules: [], allowCount: 0, blockCount: 0 },
          })}
        />,
      );
      expect(screen.getByText("No active rules")).toBeInTheDocument();
    });
  });

  describe("overflow indicator", () => {
    it("shows overflow count when more than 4 rules", () => {
      const rules: RuleSummary[] = Array.from({ length: 6 }, (_, i) => ({
        name: `Rule ${i + 1}`,
        action: "ALLOW",
        protocol: "TCP",
        portRanges: [`${80 + i}`],
        enabled: true,
      }));
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: { rules, allowCount: 6, blockCount: 0 },
          })}
        />,
      );
      expect(screen.getByText("+2 more")).toBeInTheDocument();
      expect(screen.getByText("Rule 1")).toBeInTheDocument();
      expect(screen.getByText("Rule 4")).toBeInTheDocument();
      expect(screen.queryByText("Rule 5")).not.toBeInTheDocument();
    });

    it("does not show overflow when 4 or fewer rules", () => {
      const rules: RuleSummary[] = Array.from({ length: 4 }, (_, i) => ({
        name: `Rule ${i + 1}`,
        action: "ALLOW",
        protocol: "TCP",
        portRanges: [],
        enabled: true,
      }));
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: { rules, allowCount: 4, blockCount: 0 },
          })}
        />,
      );
      expect(screen.queryByText(/more/)).not.toBeInTheDocument();
    });
  });

  describe("disabled rules", () => {
    it("renders disabled rules with reduced opacity", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              rules: [
                { name: "Disabled Rule", action: "ALLOW", protocol: "TCP", portRanges: [], enabled: false },
              ],
              allowCount: 1,
              blockCount: 0,
            },
          })}
        />,
      );
      const row = screen.getByText("Disabled Rule").closest("div");
      expect(row?.className).toContain("opacity-40");
    });

    it("renders enabled rules without reduced opacity", () => {
      render(<RuleEdgeComponent {...makeEdgeProps()} />);
      const row = screen.getByText("Allow HTTP").closest("div");
      expect(row?.className).not.toContain("opacity-40");
    });
  });

  describe("action dots", () => {
    it("renders green dot for ALLOW action", () => {
      render(<RuleEdgeComponent {...makeEdgeProps()} />);
      const dot = screen.getByText("Allow HTTP").previousElementSibling as HTMLElement;
      expect(dot.style.background).toBe("rgb(0, 214, 143)");
    });

    it("renders red dot for BLOCK action", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              rules: [blockRule],
              allowCount: 0,
              blockCount: 1,
            },
          })}
        />,
      );
      const dot = screen.getByText("Block SSH").previousElementSibling as HTMLElement;
      expect(dot.style.background).toBe("rgb(255, 77, 94)");
    });
  });

  describe("click handler", () => {
    it("calls onLabelClick when label card is clicked", () => {
      const onClick = vi.fn();
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              rules: [allowRule],
              allowCount: 1,
              blockCount: 0,
              onLabelClick: onClick,
            },
          })}
        />,
      );

      fireEvent.click(screen.getByText("Allow HTTP"));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("does not throw when onLabelClick is undefined", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              rules: [allowRule],
              allowCount: 1,
              blockCount: 0,
              onLabelClick: undefined,
            },
          })}
        />,
      );

      expect(() => {
        fireEvent.click(screen.getByText("Allow HTTP"));
      }).not.toThrow();
    });
  });

  describe("direction header", () => {
    it("shows direction header when zone names are provided", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              rules: [allowRule],
              allowCount: 1,
              blockCount: 0,
              sourceZoneName: "External",
              destZoneName: "Internal",
            },
          })}
        />,
      );
      // The arrow entity renders as the → character
      const header = screen.getByText(/External/);
      expect(header).toBeInTheDocument();
      expect(header.textContent).toContain("Internal");
    });

    it("does not show direction header when zone names are missing", () => {
      render(<RuleEdgeComponent {...makeEdgeProps()} />);
      const labelRenderer = screen.getByTestId("edge-label-renderer");
      // No border-b element for direction header
      const headers = labelRenderer.querySelectorAll(".border-b");
      expect(headers.length).toBe(0);
    });
  });

  describe("bidirectional edge offset", () => {
    it("offsets edge path horizontally when edgeOffset is set", () => {
      // With edgeOffset=-1, sourceX/targetX should shift by -25px
      // getSmoothStepPath mock returns fixed path, but we can verify the component renders
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              rules: [allowRule],
              allowCount: 1,
              blockCount: 0,
              edgeOffset: -1,
            },
          })}
        />,
      );
      expect(screen.getByTestId("edge-edge-1")).toBeInTheDocument();
    });

    it("places label on opposite side for negative offset", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              rules: [allowRule],
              allowCount: 1,
              blockCount: 0,
              edgeOffset: -1,
            },
          })}
        />,
      );
      const button = screen.getByText("Allow HTTP").closest("button") as HTMLElement;
      expect(button.style.transform).toContain("calc(-100% - 12px)");
    });

    it("places label on right side for positive offset", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({
            data: {
              rules: [allowRule],
              allowCount: 1,
              blockCount: 0,
              edgeOffset: 1,
            },
          })}
        />,
      );
      const button = screen.getByText("Allow HTTP").closest("button") as HTMLElement;
      expect(button.style.transform).toContain("translate(12px");
    });
  });

  describe("handles undefined data gracefully", () => {
    it("defaults to amber color and empty rules when data is undefined", () => {
      render(
        <RuleEdgeComponent
          {...makeEdgeProps({ data: undefined as never })}
        />,
      );
      const edge = screen.getByTestId("edge-edge-1");
      expect(edge).toHaveAttribute("data-stroke", "#ffaa2c");
      expect(screen.getByText("No active rules")).toBeInTheDocument();
    });
  });
});
