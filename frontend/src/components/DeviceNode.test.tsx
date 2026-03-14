import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DeviceNode from "./DeviceNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Top: "top", Bottom: "bottom" },
}));

const defaultData = {
  label: "Gateway",
  deviceType: "gateway",
  model: "UDM-Pro",
  ip: "192.168.1.1",
  status: "online",
  clientCount: 5,
  onSelect: vi.fn(),
};

describe("DeviceNode", () => {
  it("renders device name", () => {
    render(<DeviceNode data={defaultData} />);
    expect(screen.getByText("Gateway")).toBeInTheDocument();
  });

  it("renders model name", () => {
    render(<DeviceNode data={defaultData} />);
    expect(screen.getByText("UDM-Pro")).toBeInTheDocument();
  });

  it("renders IP address", () => {
    render(<DeviceNode data={defaultData} />);
    expect(screen.getByText("192.168.1.1")).toBeInTheDocument();
  });

  it("renders client count", () => {
    render(<DeviceNode data={defaultData} />);
    expect(screen.getByText("5 clients")).toBeInTheDocument();
  });

  it("renders singular client text for 1 client", () => {
    render(<DeviceNode data={{ ...defaultData, clientCount: 1 }} />);
    expect(screen.getByText("1 client")).toBeInTheDocument();
  });

  it("shows online status dot", () => {
    const { container } = render(<DeviceNode data={defaultData} />);
    const dot = container.querySelector("[class*='bg-status-success']") ?? container.querySelector("[class*='bg-emerald']");
    expect(dot).not.toBeNull();
  });

  it("shows offline status dot", () => {
    const { container } = render(<DeviceNode data={{ ...defaultData, status: "offline" }} />);
    const dot = container.querySelector("[class*='status-danger']") ?? container.querySelector("[class*='red']");
    expect(dot).not.toBeNull();
  });

  it("calls onSelect when clicked", () => {
    const handler = vi.fn();
    render(<DeviceNode data={{ ...defaultData, onSelect: handler }} />);
    fireEvent.click(screen.getByText("Gateway"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("renders handles", () => {
    render(<DeviceNode data={defaultData} />);
    expect(screen.getAllByTestId("handle").length).toBeGreaterThanOrEqual(2);
  });

  it("calls onSelect on Enter keydown", () => {
    const handler = vi.fn();
    const { container } = render(<DeviceNode data={{ ...defaultData, onSelect: handler }} />);
    const node = container.querySelector("[role='button']")!;
    fireEvent.keyDown(node, { key: "Enter" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls onSelect on Space keydown", () => {
    const handler = vi.fn();
    const { container } = render(<DeviceNode data={{ ...defaultData, onSelect: handler }} />);
    const node = container.querySelector("[role='button']")!;
    fireEvent.keyDown(node, { key: " " });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call onSelect on other keys", () => {
    const handler = vi.fn();
    const { container } = render(<DeviceNode data={{ ...defaultData, onSelect: handler }} />);
    const node = container.querySelector("[role='button']")!;
    fireEvent.keyDown(node, { key: "Tab" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("renders different device types without error", () => {
    for (const type of ["gateway", "switch", "ap", "other"]) {
      const { unmount } = render(<DeviceNode data={{ ...defaultData, deviceType: type }} />);
      unmount();
    }
  });
});
