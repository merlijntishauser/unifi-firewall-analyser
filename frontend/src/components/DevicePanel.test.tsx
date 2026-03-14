import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DevicePanel from "./DevicePanel";
import type { TopologyDevice } from "../api/types";

const testDevice: TopologyDevice = {
  mac: "aa:bb:cc:dd:ee:01",
  name: "Test Switch",
  model: "USW-24",
  model_name: "UniFi Switch 24",
  type: "switch",
  ip: "192.168.1.2",
  version: "7.1.0",
  uptime: 90061,
  status: "online",
  client_count: 10,
  ports: [
    { idx: 1, name: "Port 1", speed: 1000, up: true, poe: true, poe_power: 4.2, connected_device: "AP-Office", connected_mac: "aa:bb:cc:dd:ee:03", native_vlan: 1 },
    { idx: 2, name: "Port 2", speed: 100, up: true, poe: false, poe_power: null, connected_device: null, connected_mac: null, native_vlan: 10 },
    { idx: 3, name: "Port 3", speed: null, up: false, poe: true, poe_power: null, connected_device: null, connected_mac: null, native_vlan: null },
  ],
};

describe("DevicePanel", () => {
  it("renders device name", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getByText("Test Switch")).toBeInTheDocument();
  });

  it("renders device details", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getByText("192.168.1.2")).toBeInTheDocument();
    expect(screen.getByText(/aa:bb:cc:dd:ee:01/i)).toBeInTheDocument();
    expect(screen.getByText("7.1.0")).toBeInTheDocument();
  });

  it("formats uptime", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getByText(/1d 1h 1m/)).toBeInTheDocument();
  });

  it("renders port table", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getByText("AP-Office")).toBeInTheDocument();
    expect(screen.getByText("1G")).toBeInTheDocument();
  });

  it("shows PoE power for active PoE ports", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getAllByText("4.2W").length).toBeGreaterThanOrEqual(1);
  });

  it("renders online status", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getByText(/online/i)).toBeInTheDocument();
  });

  it("renders client count", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getAllByText("10").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onClose when close button clicked", () => {
    const handler = vi.fn();
    render(<DevicePanel device={testDevice} onClose={handler} />);
    fireEvent.click(screen.getByLabelText("Close panel"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("renders model name", () => {
    render(<DevicePanel device={testDevice} onClose={vi.fn()} />);
    expect(screen.getByText("UniFi Switch 24")).toBeInTheDocument();
  });
});
