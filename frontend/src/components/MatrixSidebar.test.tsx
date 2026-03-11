import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MatrixSidebar from "./MatrixSidebar";
import type { Zone } from "../api/types";

const testZones: Zone[] = [
  { id: "z1", name: "Internal", networks: [] },
  { id: "z2", name: "External", networks: [] },
  { id: "z3", name: "IoT", networks: [] },
];

describe("MatrixSidebar", () => {
  it("renders grade legend entries", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
  });

  it("renders grade score ranges", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByText("90 - 100")).toBeInTheDocument();
    expect(screen.getByText("80 - 89")).toBeInTheDocument();
    expect(screen.getByText("65 - 79")).toBeInTheDocument();
    expect(screen.getByText("50 - 64")).toBeInTheDocument();
    expect(screen.getByText("0 - 49")).toBeInTheDocument();
  });

  it("renders cell color legend", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByText("A / B grade")).toBeInTheDocument();
    expect(screen.getByText("C grade")).toBeInTheDocument();
    expect(screen.getByText("D / F grade")).toBeInTheDocument();
    expect(screen.getByText("No rules")).toBeInTheDocument();
  });

  it("renders all zone checkboxes", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Internal")).toBeInTheDocument();
    expect(screen.getByLabelText("External")).toBeInTheDocument();
    expect(screen.getByLabelText("IoT")).toBeInTheDocument();
  });

  it("shows checkboxes as checked when zone is visible", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    const checkbox = screen.getByLabelText("Internal") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("shows checkbox as unchecked when zone is hidden", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set(["z1"])}
        onToggleZone={vi.fn()}
      />,
    );

    const checkbox = screen.getByLabelText("Internal") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it("calls onToggleZone when checkbox is clicked", () => {
    const onToggleZone = vi.fn();
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={onToggleZone}
      />,
    );

    fireEvent.click(screen.getByLabelText("External"));
    expect(onToggleZone).toHaveBeenCalledWith("z2");
  });

  it("labels UniFi default zones", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getAllByText("UniFi default")).toHaveLength(2);
  });

  it("labels UniFi default zones with normalized names", () => {
    render(
      <MatrixSidebar
        zones={[
          { id: "z1", name: " vpn ", networks: [] },
          { id: "z2", name: "dmz", networks: [] },
          { id: "z3", name: "Custom", networks: [] },
        ]}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: /vpn/i }).closest("label")).toHaveTextContent("UniFi default");
    expect(screen.getByRole("checkbox", { name: /dmz/i }).closest("label")).toHaveTextContent("UniFi default");
    expect(screen.getByRole("checkbox", { name: "Custom" }).closest("label")).not.toHaveTextContent("UniFi default");
  });

  it("does not label custom zones as UniFi defaults", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("IoT").closest("label")).not.toHaveTextContent("UniFi default");
  });

  it("renders section headings", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByText("Security Score")).toBeInTheDocument();
    expect(screen.getByText("Cell Colors")).toBeInTheDocument();
    expect(screen.getByText("Zones")).toBeInTheDocument();
  });

  it("renders scoring explanation", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByText(/starts at 100/)).toBeInTheDocument();
    expect(screen.getByText("-15")).toBeInTheDocument();
    expect(screen.getByText("-8")).toBeInTheDocument();
    expect(screen.getByText("-2")).toBeInTheDocument();
  });

  it("renders grade hints", () => {
    render(
      <MatrixSidebar
        zones={testZones}
        hiddenZoneIds={new Set()}
        onToggleZone={vi.fn()}
      />,
    );

    expect(screen.getByText("Minimal or no issues")).toBeInTheDocument();
    expect(screen.getByText("Critical issues")).toBeInTheDocument();
  });
});
