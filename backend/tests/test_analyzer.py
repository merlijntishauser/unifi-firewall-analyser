"""Tests for static firewall rule analyzer."""

from app.models import Rule
from app.services.analyzer import Finding, analyze_zone_pair, compute_grade


def _rule(
    *,
    id: str = "r1",
    name: str = "Test Rule",
    enabled: bool = True,
    action: str = "ALLOW",
    source_zone_id: str = "zone-src",
    destination_zone_id: str = "zone-dst",
    protocol: str = "all",
    port_ranges: list[str] | None = None,
    ip_ranges: list[str] | None = None,
    index: int = 100,
    predefined: bool = False,
) -> Rule:
    return Rule(
        id=id,
        name=name,
        enabled=enabled,
        action=action,
        source_zone_id=source_zone_id,
        destination_zone_id=destination_zone_id,
        protocol=protocol,
        port_ranges=port_ranges or [],
        ip_ranges=ip_ranges or [],
        index=index,
        predefined=predefined,
    )


class TestComputeGrade:
    def test_perfect_score(self) -> None:
        assert compute_grade(100) == "A"

    def test_a_grade(self) -> None:
        assert compute_grade(90) == "A"

    def test_b_grade(self) -> None:
        assert compute_grade(80) == "B"
        assert compute_grade(89) == "B"

    def test_c_grade(self) -> None:
        assert compute_grade(65) == "C"
        assert compute_grade(79) == "C"

    def test_d_grade(self) -> None:
        assert compute_grade(50) == "D"
        assert compute_grade(64) == "D"

    def test_f_grade(self) -> None:
        assert compute_grade(49) == "F"
        assert compute_grade(0) == "F"


class TestAnalyzeZonePair:
    def test_no_rules_returns_low_finding(self) -> None:
        result = analyze_zone_pair([], "LAN", "WAN")
        assert any(f.id == "no-explicit-rules" for f in result.findings)
        assert result.score <= 100

    def test_allow_all_protocols_ports_high(self) -> None:
        rules = [_rule(protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "allow-all-protocols-ports" for f in result.findings)
        assert any(f.severity == "high" for f in result.findings)

    def test_allow_with_port_restriction_no_finding(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["443"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "allow-all-protocols-ports" for f in result.findings)

    def test_allow_all_from_external(self) -> None:
        rules = [_rule(source_zone_id="zone-ext", protocol="all")]
        result = analyze_zone_pair(rules, "External", "LAN")
        assert any(f.id == "allow-all-external" for f in result.findings)

    def test_allow_from_external_not_triggered_for_non_external(self) -> None:
        rules = [_rule(protocol="all")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "allow-all-external" for f in result.findings)

    def test_allow_external_to_internal(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["80"], ip_ranges=[])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_allow_external_to_internal_not_triggered_with_ip_restriction(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["80"], ip_ranges=["10.0.0.5"])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert not any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_disabled_block_rule(self) -> None:
        rules = [_rule(enabled=False, action="BLOCK")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "disabled-block-rule" for f in result.findings)

    def test_enabled_block_rule_no_finding(self) -> None:
        rules = [_rule(enabled=True, action="BLOCK")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "disabled-block-rule" for f in result.findings)

    def test_shadowed_rule(self) -> None:
        rules = [
            _rule(id="r1", action="ALLOW", protocol="all", port_ranges=[], index=100),
            _rule(id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        shadowed = [f for f in result.findings if f.id == "shadowed-rule"]
        assert len(shadowed) == 1
        assert shadowed[0].rule_id == "r2"

    def test_no_shadow_when_different_actions(self) -> None:
        rules = [
            _rule(id="r1", action="ALLOW", protocol="all", port_ranges=[], index=100),
            _rule(id="r2", action="BLOCK", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_wide_port_range(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["1-65535"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "wide-port-range" for f in result.findings)

    def test_narrow_port_range_no_finding(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["80-443"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "wide-port-range" for f in result.findings)

    def test_predefined_rule(self) -> None:
        rules = [_rule(predefined=True, action="BLOCK")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "predefined-unreviewed" for f in result.findings)

    def test_score_deductions(self) -> None:
        # One high finding = -15
        rules = [_rule(protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "External", "WAN")
        assert result.score < 100

    def test_score_clamped_to_zero(self) -> None:
        # Many high findings should not go below 0
        rules = [
            _rule(id=f"r{i}", protocol="all", port_ranges=[], index=i)
            for i in range(20)
        ]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert result.score >= 0

    def test_grade_returned(self) -> None:
        result = analyze_zone_pair([], "LAN", "WAN")
        assert result.grade in ("A", "B", "C", "D", "F")

    def test_finding_has_source_static(self) -> None:
        result = analyze_zone_pair([], "LAN", "WAN")
        assert all(f.source == "static" for f in result.findings)

    def test_malformed_port_range(self) -> None:
        """Malformed port range like 'abc-def' should not crash."""
        rules = [_rule(protocol="tcp", port_ranges=["abc-def"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "wide-port-range" for f in result.findings)

    def test_no_shadow_when_different_port_ranges(self) -> None:
        """Rules with same action/protocol but different port ranges are not shadowed."""
        rules = [
            _rule(id="r1", action="ALLOW", protocol="tcp", port_ranges=["80"], index=100),
            _rule(id="r2", action="ALLOW", protocol="tcp", port_ranges=["443"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_ip_ranges(self) -> None:
        """Earlier rule with ip_ranges does not shadow a later rule."""
        rules = [
            _rule(id="r1", action="ALLOW", protocol="all", port_ranges=[], ip_ranges=["10.0.0.0/8"], index=100),
            _rule(id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)
