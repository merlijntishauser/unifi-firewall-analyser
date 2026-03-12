# Analysis Fidelity and Explainability Design

Status: Proposed
Date: 2026-03-12

## Goal

Raise the trustworthiness of static analysis and traffic simulation by closing constraint gaps, adding structured reasoning to findings and simulation results, and anchoring correctness with fixture-based golden tests.

This is Phase 1 of roadmap item 1. Phase 2 (AI analysis reliability) is covered separately in `2026-03-12-ai-analysis-design.md`.

## Current Problems

### Simulator gaps

The simulator's `evaluate_rules` only checks `protocol` and `port_ranges`. The Rule model has 12+ additional constraint fields that are silently ignored:

- `ip_ranges`, `source_ip_ranges` -- source IP restrictions
- `source_address_group_members`, `destination_address_group_members` -- address group restrictions
- `source_port_ranges`, `source_port_group_members`, `destination_port_group_members` -- source port and port group restrictions
- `source_mac_addresses`, `destination_mac_addresses` -- MAC address restrictions
- `source_network_id`, `destination_network_id` -- network-level restrictions
- `connection_state_type` -- connection state matching
- `schedule` -- time-based access control
- `match_ip_sec` -- IPSec matching

This means simulation results can be misleading: reporting ALLOW when a rule wouldn't match due to IP restrictions, or BLOCK when a more specific allow was skipped.

### Analyzer gaps

The static analyzer covers broad allow checks, disabled blocks, wide port ranges, predefined rules, and shadowed rules. It does not check for:

- Allow rules without connection state tracking
- Partially overlapping allow/block interactions
- Address groups resolving to unrestricted ranges
- Block/reject rules without logging
- Schedule-dependent access

### No structured reasoning

Findings have `title` and `description` but no structured `rationale` explaining *why* something is flagged. Simulation evaluations show terse reason strings with no visibility into what couldn't be evaluated.

### No regression anchors

There are no fixture-based tests with expected findings, grades, and simulation outcomes. Analyzer changes can silently shift scoring behavior.

## Design

### Stream A: Simulator Parity

#### Extended simulation input

Add three optional parameters to `evaluate_rules`:

- `source_ip: str | None` -- matched against `ip_ranges`, `source_ip_ranges`, `source_address_group_members`
- `destination_ip: str | None` -- matched against `destination_address_group_members`
- `source_port: int | None` -- matched against `source_port_ranges`, `source_port_group_members`

The existing `port` parameter is extended to also check `destination_port_group_members` (currently only checks `port_ranges`).

#### Full constraint matching

For each enabled rule, evaluate all resolvable constraints:

1. Protocol (existing)
2. Destination port: `port_ranges` + `destination_port_group_members`
3. Source port: `source_port_ranges` + `source_port_group_members`
4. Source IP: `ip_ranges`, `source_ip_ranges`, `source_address_group_members`
5. Destination IP: `destination_address_group_members`

Network ID matching (`source_network_id`, `destination_network_id`) is skipped -- zone resolution already handles this.

#### Unresolvable constraint reporting

When a rule has constraints the simulator cannot evaluate from the packet input, the `RuleEvaluation` gains a new field:

```
unresolvable_constraints: list[str] = []
```

Populated with human-readable descriptions:

- `"Rule requires MAC aa:bb:cc:dd:ee:ff"`
- `"Rule has schedule 'office-hours'"`
- `"Rule requires IPSec match 'match-ipsec'"`
- `"Rule requires connection state 'established'"`

A match with unresolvable constraints reports `matched: True` but surfaces the constraints so users understand the simulation's limits.

The `SimulationResult` gains:

```
assumptions: list[str] = []
```

Summarizing what the simulation could and couldn't evaluate for the overall result.

### Stream B: Static Analyzer Expansion

Five new checks, each as a private `_check_*` function:

#### 1. `no-connection-state` (high)

Fires when an enabled ALLOW rule has no `connection_state_type` set and is not itself a return-traffic rule.

Rationale: Allowing traffic without connection state tracking means the rule accepts both new and established connections. Most allow rules should restrict to new connections with separate established/related return rules.

#### 2. `overlapping-allow-block` (medium)

Fires when an earlier ALLOW and a later BLOCK (or vice versa) partially overlap in constraints without one fully shadowing the other. Uses `_rule_shadows` as a building block -- if rule A doesn't shadow rule B but they share the same protocol and have overlapping port ranges, flag the interaction.

Rationale: Partially overlapping rules with different actions create ambiguous intent. The effective behavior depends on evaluation order, which may not match the administrator's expectation.

#### 3. `broad-address-group` (medium)

Fires when an enabled ALLOW rule uses address group members containing `0.0.0.0/0`, `::/0`, or `any`. Checks both `source_address_group_members` and `destination_address_group_members`.

Rationale: An address group that resolves to all addresses provides no restriction. The rule behaves as if no address constraint exists.

#### 4. `missing-block-logging` (low)

Fires when an enabled BLOCK or REJECT rule has `connection_logging` set to `False`.

Rationale: Block rules without logging make it difficult to detect and investigate denied traffic. Logging provides an audit trail for troubleshooting and security review.

#### 5. `schedule-dependent-allow` (low)

Fires when an enabled ALLOW rule has a non-empty `schedule` field.

Rationale: Schedule-dependent rules create time windows where access policy changes. This is not necessarily wrong, but should be explicitly acknowledged since security posture varies by time of day.

### Stream C: Finding Model Enrichment

#### Finding dataclass and FindingModel

Add to both `Finding` (in `analyzer.py`) and `FindingModel` (in `models.py`):

```
rationale: str = ""
```

`description` is the *what* ("Rule 'X' allows all traffic from WAN"). `rationale` is the *why* ("This is flagged because the rule has no port, protocol, or IP restriction, and the source zone is internet-facing.").

All existing checks get `rationale` strings added retroactively. New checks include them from the start.

#### Simulation response models

- `RuleEvaluation` gains `unresolvable_constraints: list[str] = []`
- `SimulationResult` gains `assumptions: list[str] = []`

#### Frontend types

Mirror in `api/types.ts`:

- `Finding` gets `rationale?: string`
- `RuleEvaluation` gets `unresolvable_constraints?: string[]`
- `SimulationResult` gets `assumptions?: string[]`

Optional fields for backwards compatibility.

### Stream D: UI Polish

#### Findings section in RulePanel

- Show `rationale` as a collapsible detail below the description. Collapsed by default. A "Why?" toggle or chevron reveals it.
- Group findings by severity (high, medium, low) with subtle section dividers.
- For findings with a `rule_id`, add a visual link connecting the finding to the corresponding rule in the rules list.

#### Simulation section in RulePanel

- Show each evaluation step as a visual pass/fail row: green check for matched constraints, red X for mismatches, amber warning icon for unresolvable constraints.
- Unresolvable constraints render inline as a muted warning: `"Schedule 'office-hours' not evaluated"`.
- The `assumptions` list renders at the top of the simulation result as an amber callout banner. Only shown when assumptions are non-empty.

#### Simulation input form

Extend the existing form with:

- Source IP field (optional)
- Source port field (optional)

Alongside existing protocol and destination port fields. All new fields optional -- omitting means "match any".

### Stream E: Golden Test Fixtures

#### Format

Each fixture is a Python module in `backend/tests/fixtures/`:

- `ZONES: list[dict]` -- zone definitions with networks
- `RULES: list[dict]` -- rule definitions with all constraint fields
- `EXPECTED_FINDINGS: list[str]` -- expected finding IDs
- `EXPECTED_GRADE: str` -- expected letter grade
- `EXPECTED_SIMULATIONS: list[dict]` -- input packet params and expected verdict + matched rule

Python modules rather than JSON for inline comments explaining each rule's purpose.

#### Fixture sets

1. **`clean_segmented`** -- 3 zones, tight rules with state tracking, port restrictions, logging. Grade A, no findings.
2. **`permissive_homelab`** -- 4 zones, broad allows between internal zones, no state tracking. Grade C-D, findings: `no-connection-state`, `allow-all-protocols-ports`.
3. **`exposed_external`** -- external zone with unrestricted inbound allows. Grade F, findings: `allow-all-external`, `allow-external-to-internal`.
4. **`complex_interactions`** -- overlapping allow/block, shadowed rules, mixed enabled/disabled. Findings: `shadowed-rule`, `overlapping-allow-block`, `disabled-block-rule`.
5. **`constrained_rules`** -- rules using address groups (including one broad), schedules, IPSec. Findings: `broad-address-group`, `schedule-dependent-allow`.
6. **`large_ruleset`** -- 25+ rules across 5 zones, mixed constraints. Exercises scoring at scale.

#### Test structure

A parametrized test class `TestGoldenFixtures` loads each fixture, runs `analyze_zone_pair` and `evaluate_rules`, and asserts findings, grade, and simulation outcomes match expectations.

## Acceptance Criteria

- The simulator evaluates all resolvable Rule constraints and explicitly reports unresolvable ones.
- Five new static analysis checks fire correctly on targeted test cases.
- All existing and new findings include a structured `rationale`.
- The RulePanel shows collapsible rationale, grouped findings, visual evaluation traces, and assumption banners.
- Six golden test fixtures pass as regression anchors for findings, grades, and simulation outcomes.
- All quality thresholds maintained: 98%+ Python coverage, 95%+ TypeScript coverage, max complexity 15, mypy strict.
