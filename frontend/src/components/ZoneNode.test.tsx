import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ZoneNodeComponent from "./ZoneNode";
import type { NodeProps } from "@xyflow/react";
import type { ZoneNode } from "./ZoneNode";

// Mock @xyflow/react Handle component and Position enum
vi.mock("@xyflow/react", () => ({
  Handle: ({ type, position }: { type: string; position: string }) => (
    <div data-testid={`handle-${type}`} data-position={position} />
  ),
  Position: {
    Top: "top",
    Bottom: "bottom",
    Left: "left",
    Right: "right",
  },
}));

function makeProps(
  overrides: Partial<NodeProps<ZoneNode>> & { data: ZoneNode["data"] },
): NodeProps<ZoneNode> {
  return {
    id: "test-node",
    type: "zone",
    data: overrides.data,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    ...overrides,
  } as unknown as NodeProps<ZoneNode>;
}

describe("ZoneNodeComponent", () => {
  describe("rendering", () => {
    it("renders zone name", () => {
      render(
        <ZoneNodeComponent
          {...makeProps({
            data: { label: "External", networks: [] },
          })}
        />,
      );
      expect(screen.getByText("External")).toBeInTheDocument();
    });

    it("renders network count badge", () => {
      const networks = [
        { id: "n1", name: "LAN", vlan_id: 1, subnet: "10.0.0.0/24" },
        { id: "n2", name: "WAN", vlan_id: null, subnet: null },
      ];
      render(
        <ZoneNodeComponent
          {...makeProps({
            data: { label: "Internal", networks },
          })}
        />,
      );
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("renders 0 for network count when no networks", () => {
      render(
        <ZoneNodeComponent
          {...makeProps({
            data: { label: "Empty", networks: [] },
          })}
        />,
      );
      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("renders handles for source and target", () => {
      render(
        <ZoneNodeComponent
          {...makeProps({
            data: { label: "Test", networks: [] },
          })}
        />,
      );
      expect(screen.getByTestId("handle-target")).toBeInTheDocument();
      expect(screen.getByTestId("handle-source")).toBeInTheDocument();
    });
  });

  describe("toggle button", () => {
    it("shows 'Show networks' button when networks exist", () => {
      render(
        <ZoneNodeComponent
          {...makeProps({
            data: {
              label: "Internal",
              networks: [{ id: "n1", name: "LAN", vlan_id: 1, subnet: "10.0.0.0/24" }],
            },
          })}
        />,
      );
      expect(screen.getByText("Show networks")).toBeInTheDocument();
    });

    it("does not show toggle button when no networks", () => {
      render(
        <ZoneNodeComponent
          {...makeProps({
            data: { label: "Empty", networks: [] },
          })}
        />,
      );
      expect(screen.queryByText("Show networks")).not.toBeInTheDocument();
      expect(screen.queryByText("Hide networks")).not.toBeInTheDocument();
    });

    it("toggles to 'Hide networks' and shows network list on click", () => {
      render(
        <ZoneNodeComponent
          {...makeProps({
            data: {
              label: "Internal",
              networks: [{ id: "n1", name: "LAN", vlan_id: 1, subnet: "10.0.0.0/24" }],
            },
          })}
        />,
      );

      fireEvent.click(screen.getByText("Show networks"));

      expect(screen.getByText("Hide networks")).toBeInTheDocument();
      expect(screen.getByText("LAN")).toBeInTheDocument();
    });

    it("hides networks again when clicking 'Hide networks'", () => {
      render(
        <ZoneNodeComponent
          {...makeProps({
            data: {
              label: "Internal",
              networks: [{ id: "n1", name: "LAN", vlan_id: 1, subnet: "10.0.0.0/24" }],
            },
          })}
        />,
      );

      fireEvent.click(screen.getByText("Show networks"));
      expect(screen.getByText("LAN")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Hide networks"));
      expect(screen.queryByText("LAN")).not.toBeInTheDocument();
      expect(screen.getByText("Show networks")).toBeInTheDocument();
    });
  });

  describe("network details", () => {
    it("shows VLAN ID when present", () => {
      render(
        <ZoneNodeComponent
          {...makeProps({
            data: {
              label: "Internal",
              networks: [{ id: "n1", name: "LAN", vlan_id: 10, subnet: null }],
            },
          })}
        />,
      );

      fireEvent.click(screen.getByText("Show networks"));
      expect(screen.getByText("VLAN 10")).toBeInTheDocument();
    });

    it("does not show VLAN when vlan_id is null", () => {
      render(
        <ZoneNodeComponent
          {...makeProps({
            data: {
              label: "Internal",
              networks: [{ id: "n1", name: "WAN", vlan_id: null, subnet: null }],
            },
          })}
        />,
      );

      fireEvent.click(screen.getByText("Show networks"));
      expect(screen.queryByText(/VLAN/)).not.toBeInTheDocument();
    });

    it("shows subnet when present", () => {
      render(
        <ZoneNodeComponent
          {...makeProps({
            data: {
              label: "Internal",
              networks: [{ id: "n1", name: "LAN", vlan_id: null, subnet: "192.168.1.0/24" }],
            },
          })}
        />,
      );

      fireEvent.click(screen.getByText("Show networks"));
      expect(screen.getByText("192.168.1.0/24")).toBeInTheDocument();
    });

    it("does not show subnet when null", () => {
      render(
        <ZoneNodeComponent
          {...makeProps({
            data: {
              label: "Internal",
              networks: [{ id: "n1", name: "WAN", vlan_id: null, subnet: null }],
            },
          })}
        />,
      );

      fireEvent.click(screen.getByText("Show networks"));
      expect(screen.getByText("WAN")).toBeInTheDocument();
    });

    it("shows multiple networks", () => {
      render(
        <ZoneNodeComponent
          {...makeProps({
            data: {
              label: "Internal",
              networks: [
                { id: "n1", name: "LAN", vlan_id: 1, subnet: "10.0.0.0/24" },
                { id: "n2", name: "Server", vlan_id: 20, subnet: "10.0.20.0/24" },
              ],
            },
          })}
        />,
      );

      fireEvent.click(screen.getByText("Show networks"));
      expect(screen.getByText("LAN")).toBeInTheDocument();
      expect(screen.getByText("Server")).toBeInTheDocument();
    });
  });

  describe("zone colors", () => {
    it("uses known colors for External zone", () => {
      const { container } = render(
        <ZoneNodeComponent
          {...makeProps({
            data: { label: "External", networks: [] },
          })}
        />,
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("border-l-red-500");
    });

    it("uses known colors for Internal zone", () => {
      const { container } = render(
        <ZoneNodeComponent
          {...makeProps({
            data: { label: "Internal", networks: [] },
          })}
        />,
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("border-l-blue-500");
    });

    it("uses known colors for Guest zone", () => {
      const { container } = render(
        <ZoneNodeComponent
          {...makeProps({
            data: { label: "Guest", networks: [] },
          })}
        />,
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("border-l-green-500");
    });

    it("uses known colors for VPN zone", () => {
      const { container } = render(
        <ZoneNodeComponent
          {...makeProps({
            data: { label: "VPN", networks: [] },
          })}
        />,
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("border-l-purple-500");
    });

    it("uses known colors for Gateway zone", () => {
      const { container } = render(
        <ZoneNodeComponent
          {...makeProps({
            data: { label: "Gateway", networks: [] },
          })}
        />,
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("border-l-yellow-500");
    });

    it("uses known colors for IoT zone", () => {
      const { container } = render(
        <ZoneNodeComponent
          {...makeProps({
            data: { label: "IoT", networks: [] },
          })}
        />,
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("border-l-teal-500");
    });

    it("uses known colors for DMZ zone", () => {
      const { container } = render(
        <ZoneNodeComponent
          {...makeProps({
            data: { label: "DMZ", networks: [] },
          })}
        />,
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("border-l-orange-500");
    });

    it("uses default colors for unknown zone", () => {
      const { container } = render(
        <ZoneNodeComponent
          {...makeProps({
            data: { label: "CustomZone", networks: [] },
          })}
        />,
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("border-l-gray-500");
    });
  });
});
