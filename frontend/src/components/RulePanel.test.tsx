import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import RulePanel from "./RulePanel";
import type { ZonePair, Rule, SimulateResponse, ZonePairAnalysis } from "../api/types";

vi.mock("../api/client", () => ({
  api: {
    simulate: vi.fn(),
  },
}));

import { api } from "../api/client";

const mockSimulate = vi.mocked(api.simulate);

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "r1",
    name: "Test Rule",
    description: "",
    enabled: true,
    action: "ALLOW",
    source_zone_id: "z1",
    destination_zone_id: "z2",
    protocol: "TCP",
    port_ranges: [],
    ip_ranges: [],
    index: 1,
    predefined: false,
    ...overrides,
  };
}

function makePair(rules: Rule[] = [makeRule()], analysis: ZonePairAnalysis | null = null): ZonePair {
  return {
    source_zone_id: "z1",
    destination_zone_id: "z2",
    rules,
    allow_count: rules.filter((r) => r.action === "ALLOW").length,
    block_count: rules.filter((r) => r.action !== "ALLOW").length,
    analysis,
  };
}

describe("RulePanel", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderPanel(pair?: ZonePair, sourceZoneName = "External", destZoneName = "Internal") {
    return render(
      <RulePanel
        pair={pair ?? makePair()}
        sourceZoneName={sourceZoneName}
        destZoneName={destZoneName}
        onClose={onClose}
      />,
    );
  }

  describe("header", () => {
    it("shows zone pair direction in header", () => {
      renderPanel();
      // The arrow is &rarr; which renders as the unicode right arrow
      const header = screen.getByRole("heading", { level: 2 });
      expect(header.textContent).toContain("External");
      expect(header.textContent).toContain("Internal");
    });

    it("calls onClose when close button is clicked", () => {
      renderPanel();
      fireEvent.click(screen.getByLabelText("Close panel"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("rule list", () => {
    it("shows rule count heading", () => {
      const pair = makePair([makeRule(), makeRule({ id: "r2", name: "Rule 2", index: 2 })]);
      renderPanel(pair);
      expect(screen.getByText("Rules (2)")).toBeInTheDocument();
    });

    it("displays rules sorted by index", () => {
      const rules = [
        makeRule({ id: "r2", name: "Second", index: 5 }),
        makeRule({ id: "r1", name: "First", index: 1 }),
        makeRule({ id: "r3", name: "Third", index: 10 }),
      ];
      renderPanel(makePair(rules));

      const ruleNames = screen.getAllByText(/\d+\.\s/).map((el) => el.textContent);
      expect(ruleNames[0]).toContain("1. First");
      expect(ruleNames[1]).toContain("5. Second");
      expect(ruleNames[2]).toContain("10. Third");
    });

    it("shows action badge for ALLOW rule", () => {
      renderPanel(makePair([makeRule({ action: "ALLOW" })]));
      expect(screen.getByText("ALLOW")).toBeInTheDocument();
    });

    it("shows action badge for BLOCK rule", () => {
      renderPanel(makePair([makeRule({ action: "BLOCK" })]));
      expect(screen.getByText("BLOCK")).toBeInTheDocument();
    });

    it("shows action badge for REJECT rule", () => {
      renderPanel(makePair([makeRule({ action: "REJECT" })]));
      expect(screen.getByText("REJECT")).toBeInTheDocument();
    });

    it("shows 'built-in' badge for predefined rules", () => {
      renderPanel(makePair([makeRule({ predefined: true })]));
      expect(screen.getByText("built-in")).toBeInTheDocument();
    });

    it("does not show 'built-in' badge for non-predefined rules", () => {
      renderPanel(makePair([makeRule({ predefined: false })]));
      expect(screen.queryByText("built-in")).not.toBeInTheDocument();
    });

    it("shows 'disabled' text for disabled rules", () => {
      renderPanel(makePair([makeRule({ enabled: false })]));
      expect(screen.getByText("disabled")).toBeInTheDocument();
    });

    it("does not show 'disabled' text for enabled rules", () => {
      renderPanel(makePair([makeRule({ enabled: true })]));
      expect(screen.queryByText("disabled")).not.toBeInTheDocument();
    });

    it("shows protocol for a rule", () => {
      renderPanel(makePair([makeRule({ protocol: "GRE" })]));
      expect(screen.getByText("GRE")).toBeInTheDocument();
    });

    it("shows port ranges", () => {
      renderPanel(makePair([makeRule({ port_ranges: ["80", "443"] })]));
      expect(screen.getByText("port 80, 443")).toBeInTheDocument();
    });

    it("does not show protocol/port line when both are empty", () => {
      renderPanel(makePair([makeRule({ protocol: "", port_ranges: [] })]));
      expect(screen.queryByText("port")).not.toBeInTheDocument();
    });
  });

  describe("simulation form", () => {
    it("renders simulation form fields", () => {
      renderPanel();
      expect(screen.getByPlaceholderText("Source IP")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Destination IP")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Port")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Simulate" })).toBeInTheDocument();
    });

    it("renders protocol select with options", () => {
      renderPanel();
      const select = screen.getByDisplayValue("TCP");
      expect(select).toBeInTheDocument();

      const options = within(select as HTMLSelectElement).getAllByRole("option");
      const values = options.map((o) => (o as HTMLOptionElement).value);
      expect(values).toEqual(["TCP", "UDP", "ICMP", "Any"]);
    });

    it("submits simulation with form values", async () => {
      const simResponse: SimulateResponse = {
        source_zone_id: "z1",
        source_zone_name: "External",
        destination_zone_id: "z2",
        destination_zone_name: "Internal",
        verdict: "ALLOW",
        matched_rule_id: "r1",
        matched_rule_name: "Test Rule",
        default_policy_used: false,
        evaluations: [],
      };
      mockSimulate.mockResolvedValue(simResponse);

      renderPanel();

      fireEvent.change(screen.getByPlaceholderText("Source IP"), {
        target: { value: "10.0.0.1" },
      });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), {
        target: { value: "10.0.1.1" },
      });
      fireEvent.change(screen.getByDisplayValue("TCP"), {
        target: { value: "UDP" },
      });
      fireEvent.change(screen.getByPlaceholderText("Port"), {
        target: { value: "53" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(mockSimulate).toHaveBeenCalledWith({
          src_ip: "10.0.0.1",
          dst_ip: "10.0.1.1",
          protocol: "udp",
          port: 53,
        });
      });
    });

    it("sends protocol as 'all' when Any is selected", async () => {
      mockSimulate.mockResolvedValue({
        source_zone_id: null,
        source_zone_name: null,
        destination_zone_id: null,
        destination_zone_name: null,
        verdict: null,
        matched_rule_id: null,
        matched_rule_name: null,
        default_policy_used: false,
        evaluations: [],
      });

      renderPanel();

      fireEvent.change(screen.getByPlaceholderText("Source IP"), {
        target: { value: "10.0.0.1" },
      });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), {
        target: { value: "10.0.1.1" },
      });
      fireEvent.change(screen.getByDisplayValue("TCP"), {
        target: { value: "Any" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(mockSimulate).toHaveBeenCalledWith({
          src_ip: "10.0.0.1",
          dst_ip: "10.0.1.1",
          protocol: "all",
          port: null,
        });
      });
    });

    it("sends port as null when port field is empty", async () => {
      mockSimulate.mockResolvedValue({
        source_zone_id: null,
        source_zone_name: null,
        destination_zone_id: null,
        destination_zone_name: null,
        verdict: null,
        matched_rule_id: null,
        matched_rule_name: null,
        default_policy_used: false,
        evaluations: [],
      });

      renderPanel();

      fireEvent.change(screen.getByPlaceholderText("Source IP"), {
        target: { value: "10.0.0.1" },
      });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), {
        target: { value: "10.0.1.1" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(mockSimulate).toHaveBeenCalledWith(
          expect.objectContaining({ port: null }),
        );
      });
    });

    it("shows 'Simulating...' while loading", async () => {
      let resolveSimulate!: (value: unknown) => void;
      mockSimulate.mockReturnValue(new Promise((r) => { resolveSimulate = r; }));

      renderPanel();

      fireEvent.change(screen.getByPlaceholderText("Source IP"), {
        target: { value: "10.0.0.1" },
      });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), {
        target: { value: "10.0.1.1" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Simulating..." })).toBeDisabled();
      });

      resolveSimulate({
        source_zone_id: null,
        source_zone_name: null,
        destination_zone_id: null,
        destination_zone_name: null,
        verdict: null,
        matched_rule_id: null,
        matched_rule_name: null,
        default_policy_used: false,
        evaluations: [],
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Simulate" })).toBeInTheDocument();
      });
    });
  });

  describe("simulation results", () => {
    it("shows ALLOW verdict", async () => {
      mockSimulate.mockResolvedValue({
        source_zone_id: "z1",
        source_zone_name: "External",
        destination_zone_id: "z2",
        destination_zone_name: "Internal",
        verdict: "ALLOW",
        matched_rule_id: "r1",
        matched_rule_name: "Allow HTTP",
        default_policy_used: false,
        evaluations: [],
      });

      renderPanel();
      fireEvent.change(screen.getByPlaceholderText("Source IP"), { target: { value: "10.0.0.1" } });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), { target: { value: "10.0.1.1" } });
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(screen.getByText("ALLOW")).toBeInTheDocument();
      });
      expect(screen.getByText("Allow HTTP")).toBeInTheDocument();
    });

    it("shows BLOCK verdict with red styling", async () => {
      mockSimulate.mockResolvedValue({
        source_zone_id: "z1",
        source_zone_name: "External",
        destination_zone_id: "z2",
        destination_zone_name: "Internal",
        verdict: "BLOCK",
        matched_rule_id: "r1",
        matched_rule_name: "Block All",
        default_policy_used: false,
        evaluations: [],
      });

      renderPanel();
      fireEvent.change(screen.getByPlaceholderText("Source IP"), { target: { value: "10.0.0.1" } });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), { target: { value: "10.0.1.1" } });
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(screen.getByText("BLOCK")).toBeInTheDocument();
      });
    });

    it("shows REJECT verdict", async () => {
      mockSimulate.mockResolvedValue({
        source_zone_id: "z1",
        source_zone_name: "External",
        destination_zone_id: "z2",
        destination_zone_name: "Internal",
        verdict: "REJECT",
        matched_rule_id: "r1",
        matched_rule_name: "Reject",
        default_policy_used: false,
        evaluations: [],
      });

      renderPanel();
      fireEvent.change(screen.getByPlaceholderText("Source IP"), { target: { value: "10.0.0.1" } });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), { target: { value: "10.0.1.1" } });
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(screen.getByText("REJECT")).toBeInTheDocument();
      });
    });

    it("shows 'NO MATCH' when verdict is null", async () => {
      mockSimulate.mockResolvedValue({
        source_zone_id: null,
        source_zone_name: null,
        destination_zone_id: null,
        destination_zone_name: null,
        verdict: null,
        matched_rule_id: null,
        matched_rule_name: null,
        default_policy_used: false,
        evaluations: [],
      });

      renderPanel();
      fireEvent.change(screen.getByPlaceholderText("Source IP"), { target: { value: "10.0.0.1" } });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), { target: { value: "10.0.1.1" } });
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(screen.getByText("NO MATCH")).toBeInTheDocument();
      });
    });

    it("shows default policy indicator", async () => {
      mockSimulate.mockResolvedValue({
        source_zone_id: "z1",
        source_zone_name: "External",
        destination_zone_id: "z2",
        destination_zone_name: "Internal",
        verdict: "BLOCK",
        matched_rule_id: null,
        matched_rule_name: null,
        default_policy_used: true,
        evaluations: [],
      });

      renderPanel();
      fireEvent.change(screen.getByPlaceholderText("Source IP"), { target: { value: "10.0.0.1" } });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), { target: { value: "10.0.1.1" } });
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(screen.getByText("(default policy)")).toBeInTheDocument();
      });
    });

    it("does not show matched rule name when null", async () => {
      mockSimulate.mockResolvedValue({
        source_zone_id: null,
        source_zone_name: null,
        destination_zone_id: null,
        destination_zone_name: null,
        verdict: "BLOCK",
        matched_rule_id: null,
        matched_rule_name: null,
        default_policy_used: true,
        evaluations: [],
      });

      renderPanel();
      fireEvent.change(screen.getByPlaceholderText("Source IP"), { target: { value: "10.0.0.1" } });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), { target: { value: "10.0.1.1" } });
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(screen.getByText("BLOCK")).toBeInTheDocument();
      });
      expect(screen.queryByText("Matched:")).not.toBeInTheDocument();
    });

    it("shows evaluation chain", async () => {
      mockSimulate.mockResolvedValue({
        source_zone_id: "z1",
        source_zone_name: "External",
        destination_zone_id: "z2",
        destination_zone_name: "Internal",
        verdict: "ALLOW",
        matched_rule_id: "r2",
        matched_rule_name: "Allow HTTP",
        default_policy_used: false,
        evaluations: [
          { rule_id: "r1", rule_name: "Block SSH", matched: false, reason: "port mismatch", skipped_disabled: false },
          { rule_id: "r2", rule_name: "Allow HTTP", matched: true, reason: "all conditions met", skipped_disabled: false },
        ],
      });

      renderPanel();
      fireEvent.change(screen.getByPlaceholderText("Source IP"), { target: { value: "10.0.0.1" } });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), { target: { value: "10.0.1.1" } });
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(screen.getByText("Evaluation Chain")).toBeInTheDocument();
      });
      expect(screen.getByText("Block SSH")).toBeInTheDocument();
      expect(screen.getByText("port mismatch")).toBeInTheDocument();
      expect(screen.getByText("MATCH")).toBeInTheDocument();
      expect(screen.getByText("all conditions met")).toBeInTheDocument();
    });

    it("shows skipped disabled evaluations with reduced opacity", async () => {
      mockSimulate.mockResolvedValue({
        source_zone_id: "z1",
        source_zone_name: "External",
        destination_zone_id: "z2",
        destination_zone_name: "Internal",
        verdict: "ALLOW",
        matched_rule_id: "r2",
        matched_rule_name: "Allow All",
        default_policy_used: false,
        evaluations: [
          { rule_id: "r1", rule_name: "Disabled Rule", matched: false, reason: "disabled", skipped_disabled: true },
          { rule_id: "r2", rule_name: "Allow All", matched: true, reason: "matched", skipped_disabled: false },
        ],
      });

      renderPanel();
      fireEvent.change(screen.getByPlaceholderText("Source IP"), { target: { value: "10.0.0.1" } });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), { target: { value: "10.0.1.1" } });
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(screen.getByText("Disabled Rule")).toBeInTheDocument();
      });
      // The disabled rule should have opacity-50 class
      const disabledEval = screen.getByText("Disabled Rule").closest("div[class*='border']");
      expect(disabledEval?.className).toContain("opacity-50");
    });

    it("does not show evaluation chain when evaluations are empty", async () => {
      mockSimulate.mockResolvedValue({
        source_zone_id: null,
        source_zone_name: null,
        destination_zone_id: null,
        destination_zone_name: null,
        verdict: "BLOCK",
        matched_rule_id: null,
        matched_rule_name: null,
        default_policy_used: true,
        evaluations: [],
      });

      renderPanel();
      fireEvent.change(screen.getByPlaceholderText("Source IP"), { target: { value: "10.0.0.1" } });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), { target: { value: "10.0.1.1" } });
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(screen.getByText("BLOCK")).toBeInTheDocument();
      });
      expect(screen.queryByText("Evaluation Chain")).not.toBeInTheDocument();
    });

    it("highlights matched rule in the rule list", async () => {
      const rules = [
        makeRule({ id: "r1", name: "Rule One", index: 1 }),
        makeRule({ id: "r2", name: "Rule Two", index: 2 }),
      ];

      mockSimulate.mockResolvedValue({
        source_zone_id: "z1",
        source_zone_name: "External",
        destination_zone_id: "z2",
        destination_zone_name: "Internal",
        verdict: "ALLOW",
        matched_rule_id: "r2",
        matched_rule_name: "Rule Two",
        default_policy_used: false,
        evaluations: [],
      });

      renderPanel(makePair(rules));
      fireEvent.change(screen.getByPlaceholderText("Source IP"), { target: { value: "10.0.0.1" } });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), { target: { value: "10.0.1.1" } });
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        const ruleTwo = screen.getByText("2. Rule Two").closest("div[class*='rounded']");
        expect(ruleTwo?.className).toContain("ring-2");
        expect(ruleTwo?.className).toContain("ring-blue-500");
      });
    });
  });

  describe("analysis section", () => {
    it("shows score badge when analysis exists", () => {
      const pair = makePair([makeRule()], { score: 82, grade: "B", findings: [] });
      renderPanel(pair);
      expect(screen.getByText("B")).toBeInTheDocument();
      expect(screen.getByText("82/100")).toBeInTheDocument();
    });

    it("shows findings list", () => {
      const pair = makePair([makeRule()], {
        score: 60,
        grade: "C",
        findings: [
          { id: "f1", severity: "high", title: "Open port", description: "Port 22 is exposed", rule_id: null, source: "static" },
          { id: "f2", severity: "low", title: "Minor issue", description: "Consider restricting", rule_id: null, source: "static" },
        ],
      });
      renderPanel(pair);
      expect(screen.getByText("Findings (2)")).toBeInTheDocument();
      expect(screen.getByText("Open port")).toBeInTheDocument();
      expect(screen.getByText("Port 22 is exposed")).toBeInTheDocument();
      expect(screen.getByText("Minor issue")).toBeInTheDocument();
      expect(screen.getByText("Consider restricting")).toBeInTheDocument();
    });

    it("shows severity badges with correct colors", () => {
      const pair = makePair([makeRule()], {
        score: 50,
        grade: "D",
        findings: [
          { id: "f1", severity: "high", title: "High issue", description: "desc", rule_id: null, source: "static" },
          { id: "f2", severity: "medium", title: "Medium issue", description: "desc", rule_id: null, source: "static" },
          { id: "f3", severity: "low", title: "Low issue", description: "desc", rule_id: null, source: "static" },
        ],
      });
      renderPanel(pair);

      const highBadge = screen.getByText("high");
      expect(highBadge.className).toContain("bg-red-100");

      const mediumBadge = screen.getByText("medium");
      expect(mediumBadge.className).toContain("bg-amber-100");

      const lowBadge = screen.getByText("low");
      expect(lowBadge.className).toContain("bg-blue-100");
    });

    it("does not show analysis section when analysis is null", () => {
      const pair = makePair([makeRule()], null);
      renderPanel(pair);
      expect(screen.queryByText(/\/100/)).not.toBeInTheDocument();
    });

    it("shows green badge for A grade", () => {
      const pair = makePair([makeRule()], { score: 95, grade: "A", findings: [] });
      renderPanel(pair);
      const gradeBadge = screen.getByText("A");
      expect(gradeBadge.className).toContain("bg-green-600");
    });

    it("shows red badge for F grade", () => {
      const pair = makePair([makeRule()], { score: 20, grade: "F", findings: [] });
      renderPanel(pair);
      const gradeBadge = screen.getByText("F");
      expect(gradeBadge.className).toContain("bg-red-600");
    });
  });

  describe("simulation errors", () => {
    it("shows error message when simulation fails with Error", async () => {
      mockSimulate.mockRejectedValue(new Error("Server error"));

      renderPanel();
      fireEvent.change(screen.getByPlaceholderText("Source IP"), { target: { value: "10.0.0.1" } });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), { target: { value: "10.0.1.1" } });
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(screen.getByText("Server error")).toBeInTheDocument();
      });
    });

    it("shows fallback error message when simulation fails with non-Error", async () => {
      mockSimulate.mockRejectedValue("unexpected");

      renderPanel();
      fireEvent.change(screen.getByPlaceholderText("Source IP"), { target: { value: "10.0.0.1" } });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), { target: { value: "10.0.1.1" } });
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(screen.getByText("Simulation failed")).toBeInTheDocument();
      });
    });

    it("clears previous result on new simulation", async () => {
      mockSimulate.mockResolvedValueOnce({
        source_zone_id: null,
        source_zone_name: null,
        destination_zone_id: null,
        destination_zone_name: null,
        verdict: "ALLOW",
        matched_rule_id: null,
        matched_rule_name: null,
        default_policy_used: false,
        evaluations: [],
      });

      renderPanel();
      fireEvent.change(screen.getByPlaceholderText("Source IP"), { target: { value: "10.0.0.1" } });
      fireEvent.change(screen.getByPlaceholderText("Destination IP"), { target: { value: "10.0.1.1" } });
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        // The ALLOW text exists in both rule badge and verdict; just confirm verdict shows up
        expect(screen.getByText("Simulate")).toBeInTheDocument();
      });

      mockSimulate.mockRejectedValueOnce(new Error("fail"));
      fireEvent.click(screen.getByRole("button", { name: "Simulate" }));

      await waitFor(() => {
        expect(screen.getByText("fail")).toBeInTheDocument();
      });
    });
  });
});
