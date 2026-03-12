"""Golden test fixtures -- regression anchors for analysis and simulation."""

from __future__ import annotations

import importlib
from types import ModuleType
from typing import Any

import pytest

from app.models import Network, Rule, Zone
from app.services.analyzer import analyze_zone_pair
from app.services.simulator import evaluate_rules, resolve_zone

FIXTURE_MODULES = [
    "tests.fixtures.clean_segmented",
    "tests.fixtures.permissive_homelab",
    "tests.fixtures.exposed_external",
    "tests.fixtures.complex_interactions",
    "tests.fixtures.constrained_rules",
]

SIMULATION_FIXTURES = [
    "tests.fixtures.clean_segmented",
    "tests.fixtures.permissive_homelab",
    "tests.fixtures.complex_interactions",
    "tests.fixtures.constrained_rules",
    "tests.fixtures.large_ruleset",
]

_GRADE_ORDER = {"A": 0, "B": 1, "C": 2, "D": 3, "F": 4}


def _load_fixture(module_name: str) -> ModuleType:
    return importlib.import_module(module_name)


def _load_zones(fixture: ModuleType) -> list[Zone]:
    raw_zones: list[dict[str, Any]] = fixture.ZONES
    return [
        Zone(
            id=str(z["id"]),
            name=str(z["name"]),
            networks=[Network(**n) for n in z.get("networks", [])],
        )
        for z in raw_zones
    ]


def _load_rules(fixture: ModuleType) -> list[Rule]:
    raw_rules: list[dict[str, Any]] = fixture.RULES
    return [Rule(**{k: v for k, v in r.items() if k in Rule.model_fields}) for r in raw_rules]


def _zone_name(zones: list[Zone], zone_id: str) -> str:
    for z in zones:
        if z.id == zone_id:
            return z.name
    return ""


class TestGoldenAnalysis:
    """Verify analyzer findings and grades against golden fixtures."""

    @pytest.mark.parametrize("module_name", FIXTURE_MODULES)
    def test_expected_findings(self, module_name: str) -> None:
        fixture = _load_fixture(module_name)
        zones = _load_zones(fixture)
        rules = _load_rules(fixture)

        zone_pairs = {(r.source_zone_id, r.destination_zone_id) for r in rules}
        all_finding_ids: list[str] = []
        for src_id, dst_id in zone_pairs:
            pair_rules = [r for r in rules if r.source_zone_id == src_id and r.destination_zone_id == dst_id]
            src_name = _zone_name(zones, src_id)
            dst_name = _zone_name(zones, dst_id)
            result = analyze_zone_pair(pair_rules, src_name, dst_name)
            all_finding_ids.extend(f.id for f in result.findings)

        expected: list[str] = fixture.EXPECTED_FINDINGS
        for expected_id in expected:
            assert expected_id in all_finding_ids, f"Expected finding '{expected_id}' not in {all_finding_ids}"
        if not expected:
            assert not all_finding_ids, f"Expected no findings but got {all_finding_ids}"

    @pytest.mark.parametrize("module_name", FIXTURE_MODULES)
    def test_expected_grade(self, module_name: str) -> None:
        fixture = _load_fixture(module_name)
        zones = _load_zones(fixture)
        rules = _load_rules(fixture)

        zone_pairs = {(r.source_zone_id, r.destination_zone_id) for r in rules}
        grades: list[str] = []
        for src_id, dst_id in zone_pairs:
            pair_rules = [r for r in rules if r.source_zone_id == src_id and r.destination_zone_id == dst_id]
            src_name = _zone_name(zones, src_id)
            dst_name = _zone_name(zones, dst_id)
            result = analyze_zone_pair(pair_rules, src_name, dst_name)
            grades.append(result.grade)

        worst_grade = max(grades, key=lambda g: _GRADE_ORDER.get(g, 5))

        if hasattr(fixture, "EXPECTED_GRADE"):
            expected_grade: str = fixture.EXPECTED_GRADE
            assert worst_grade == expected_grade, f"Expected grade {expected_grade} but got {worst_grade}"
        elif hasattr(fixture, "EXPECTED_GRADE_MIN") and hasattr(fixture, "EXPECTED_GRADE_MAX"):
            grade_min: str = fixture.EXPECTED_GRADE_MIN
            grade_max: str = fixture.EXPECTED_GRADE_MAX
            min_idx = _GRADE_ORDER[grade_min]
            max_idx = _GRADE_ORDER[grade_max]
            actual_idx = _GRADE_ORDER[worst_grade]
            assert min_idx <= actual_idx <= max_idx, (
                f"Grade {worst_grade} not in range {grade_min}-{grade_max}"
            )


class TestGoldenZonePairs:
    """Verify per-zone-pair analysis for large_ruleset fixture."""

    def test_zone_pair_findings_and_grades(self) -> None:
        fixture = _load_fixture("tests.fixtures.large_ruleset")
        zones = _load_zones(fixture)
        rules = _load_rules(fixture)

        zone_pair_tests: list[dict[str, Any]] = fixture.ZONE_PAIR_TESTS
        for zpt in zone_pair_tests:
            src_id = str(zpt["src_zone_id"])
            dst_id = str(zpt["dst_zone_id"])
            pair_rules = [r for r in rules if r.source_zone_id == src_id and r.destination_zone_id == dst_id]
            src_name = _zone_name(zones, src_id)
            dst_name = _zone_name(zones, dst_id)
            result = analyze_zone_pair(pair_rules, src_name, dst_name)

            finding_ids = [f.id for f in result.findings]
            expected_findings: list[str] = zpt["expected_findings"]
            for expected_id in expected_findings:
                assert expected_id in finding_ids, (
                    f"Zone pair {src_name}->{dst_name}: expected '{expected_id}' not in {finding_ids}"
                )
            if not expected_findings:
                assert not finding_ids, (
                    f"Zone pair {src_name}->{dst_name}: expected no findings but got {finding_ids}"
                )

            expected_grade = str(zpt["expected_grade"])
            assert result.grade == expected_grade, (
                f"Zone pair {src_name}->{dst_name}: expected grade {expected_grade} but got {result.grade}"
            )


class TestGoldenSimulation:
    """Verify simulation verdicts against golden fixtures."""

    @pytest.mark.parametrize("module_name", SIMULATION_FIXTURES)
    def test_expected_simulations(self, module_name: str) -> None:
        fixture = _load_fixture(module_name)
        zones = _load_zones(fixture)
        rules = _load_rules(fixture)

        simulations: list[dict[str, Any]] = fixture.EXPECTED_SIMULATIONS
        for sim in simulations:
            src_ip = str(sim["source_ip"])
            dst_ip = str(sim["destination_ip"])
            src_zone_id = resolve_zone(src_ip, zones)
            dst_zone_id = resolve_zone(dst_ip, zones)
            assert src_zone_id is not None, f"Could not resolve source IP {src_ip} to a zone"
            assert dst_zone_id is not None, f"Could not resolve destination IP {dst_ip} to a zone"

            protocol = str(sim["protocol"]) if "protocol" in sim else None
            port = int(sim["port"]) if "port" in sim else None

            result = evaluate_rules(
                rules,
                src_zone_id,
                dst_zone_id,
                protocol=protocol,
                port=port,
                source_ip=src_ip,
                destination_ip=dst_ip,
            )
            expected_verdict = str(sim["expected_verdict"])
            assert result.verdict == expected_verdict, (
                f"Expected {expected_verdict} for {sim} but got {result.verdict}"
            )

            if sim.get("expect_unresolvable"):
                matched_eval = next((e for e in result.evaluations if e.matched), None)
                assert matched_eval is not None, f"Expected a matched evaluation for {sim}"
                assert len(matched_eval.unresolvable_constraints) > 0, (
                    f"Expected unresolvable constraints for {sim}"
                )
