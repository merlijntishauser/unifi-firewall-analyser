import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ZoneMatrix from "./ZoneMatrix";
import type { Zone, ZonePair } from "../api/types";

// Mock MatrixCell to simplify testing
vi.mock("./MatrixCell", () => ({
  default: ({ totalRules, grade, onClick, isSelfPair }: {
    totalRules: number;
    grade: string | null;
    onClick: () => void;
    isSelfPair?: boolean;
  }) => (
    <button
      data-testid={`cell-${totalRules}`}
      data-self-pair={isSelfPair ? "true" : "false"}
      data-grade={grade ?? ""}
      onClick={onClick}
    >
      {totalRules}
    </button>
  ),
}));

const zones: Zone[] = [
  { id: "z1", name: "External", networks: [] },
  { id: "z2", name: "Internal", networks: [] },
];

const zonePairs: ZonePair[] = [
  {
    source_zone_id: "z1",
    destination_zone_id: "z2",
    rules: [
      {
        id: "r1", name: "Allow HTTP", description: "", enabled: true,
        action: "ALLOW", source_zone_id: "z1", destination_zone_id: "z2",
        protocol: "TCP", port_ranges: ["80"], ip_ranges: [], index: 1, predefined: false,
      },
    ],
    allow_count: 1,
    block_count: 0,
    analysis: { score: 85, grade: "B", findings: [] },
  },
];

describe("ZoneMatrix", () => {
  const onCellClick = vi.fn();
  const onZoneClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders zone names as row headers", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    expect(screen.getByTestId("row-header-z1")).toHaveTextContent("External");
    expect(screen.getByTestId("row-header-z2")).toHaveTextContent("Internal");
  });

  it("renders zone names as column headers", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    expect(screen.getByTestId("col-header-z1")).toHaveTextContent("External");
    expect(screen.getByTestId("col-header-z2")).toHaveTextContent("Internal");
  });

  it("calls onCellClick with the matching ZonePair when a cell is clicked", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    fireEvent.click(screen.getByTestId("cell-1"));
    expect(onCellClick).toHaveBeenCalledWith(zonePairs[0]);
  });

  it("calls onZoneClick with zone ID when a row header is clicked", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    fireEvent.click(screen.getByTestId("row-header-z1"));
    expect(onZoneClick).toHaveBeenCalledWith("z1");
  });

  it("calls onZoneClick with zone ID when a column header is clicked", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    fireEvent.click(screen.getByTestId("col-header-z1"));
    expect(onZoneClick).toHaveBeenCalledWith("z1");
  });

  it("marks diagonal cells as self-pair", () => {
    const selfPairs: ZonePair[] = [
      {
        source_zone_id: "z1", destination_zone_id: "z1",
        rules: [], allow_count: 0, block_count: 0, analysis: null,
      },
    ];
    render(
      <ZoneMatrix zones={zones} zonePairs={selfPairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    const allCells = screen.getAllByTestId(/^cell-/);
    const selfPairCells = allCells.filter((c) => c.getAttribute("data-self-pair") === "true");
    expect(selfPairCells.length).toBeGreaterThan(0);
  });

  it("renders empty cells for zone pairs without rules", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={[]} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    const allCells = screen.getAllByTestId(/^cell-/);
    allCells.forEach((cell) => {
      expect(cell).toHaveTextContent("0");
    });
  });

  it("does not call onCellClick when clicking a cell with no matching pair", () => {
    render(
      <ZoneMatrix zones={zones} zonePairs={zonePairs} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    // z2→z1 has no pair — all 0-rule cells
    const emptyCells = screen.getAllByTestId("cell-0");
    fireEvent.click(emptyCells[0]);
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it("renders nothing when zones is empty", () => {
    render(
      <ZoneMatrix zones={[]} zonePairs={[]} onCellClick={onCellClick} onZoneClick={onZoneClick} />,
    );
    expect(screen.queryByTestId("row-header-z1")).not.toBeInTheDocument();
  });
});
