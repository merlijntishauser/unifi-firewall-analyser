"""Tests for static firewall rule analyzer."""

from app.models import Rule
from app.services.analyzer import analyze_zone_pair, compute_grade


def _rule(
    *,
    rule_id: str = "r1",
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
    source_ip_ranges: list[str] | None = None,
    source_mac_addresses: list[str] | None = None,
    source_port_ranges: list[str] | None = None,
    source_network_id: str = "",
    destination_mac_addresses: list[str] | None = None,
    destination_network_id: str = "",
    source_port_group_members: list[str] | None = None,
    destination_port_group_members: list[str] | None = None,
    source_address_group_members: list[str] | None = None,
    destination_address_group_members: list[str] | None = None,
    connection_state_type: str = "",
    schedule: str = "",
    match_ip_sec: str = "",
) -> Rule:
    return Rule(
        id=rule_id,
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
        source_ip_ranges=source_ip_ranges or [],
        source_mac_addresses=source_mac_addresses or [],
        source_port_ranges=source_port_ranges or [],
        source_network_id=source_network_id,
        destination_mac_addresses=destination_mac_addresses or [],
        destination_network_id=destination_network_id,
        source_port_group_members=source_port_group_members or [],
        destination_port_group_members=destination_port_group_members or [],
        source_address_group_members=source_address_group_members or [],
        destination_address_group_members=destination_address_group_members or [],
        connection_state_type=connection_state_type,
        schedule=schedule,
        match_ip_sec=match_ip_sec,
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
        result = analyze_zone_pair(rules, "External", "DMZ")
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

    def test_allow_external_to_internal_not_triggered_with_source_ip_restriction(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["443"], source_ip_ranges=["203.0.113.10/32"])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert not any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_allow_external_to_internal_not_triggered_with_destination_network_restriction(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["443"], destination_network_id="net-dmz")]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert not any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_disabled_block_rule(self) -> None:
        rules = [_rule(enabled=False, action="BLOCK")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "disabled-block-rule" for f in result.findings)

    def test_disabled_drop_rule(self) -> None:
        rules = [_rule(enabled=False, action="DROP")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "disabled-block-rule" for f in result.findings)

    def test_enabled_block_rule_no_finding(self) -> None:
        rules = [_rule(enabled=True, action="BLOCK")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "disabled-block-rule" for f in result.findings)

    def test_shadowed_rule(self) -> None:
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="all", port_ranges=[], index=100),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        shadowed = [f for f in result.findings if f.id == "shadowed-rule"]
        assert len(shadowed) == 1
        assert shadowed[0].rule_id == "r2"

    def test_no_shadow_when_different_actions(self) -> None:
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="all", port_ranges=[], index=100),
            _rule(rule_id="r2", action="BLOCK", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "shadowed-rule" for f in result.findings)

    def test_wide_port_range(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["1-65535"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "wide-port-range" for f in result.findings)

    def test_narrow_port_range_no_finding(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["80-443"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "wide-port-range" for f in result.findings)

    def test_predefined_rules_reported_as_informational(self) -> None:
        rules = [_rule(predefined=True, protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert [f.id for f in result.findings] == ["predefined-unreviewed"]
        assert result.score == 98

    def test_multiple_predefined_rules_reported_once(self) -> None:
        rules = [
            _rule(rule_id="r1", predefined=True),
            _rule(rule_id="r2", predefined=True, name="Built-in Allow"),
        ]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert [f.id for f in result.findings] == ["predefined-unreviewed"]
        assert result.score == 98

    def test_score_deductions(self) -> None:
        # One high finding = -15
        rules = [_rule(protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "External", "WAN")
        assert result.score < 100

    def test_score_clamped_to_zero(self) -> None:
        # Many high findings should not go below 0
        rules = [
            _rule(rule_id=f"r{i}", protocol="all", port_ranges=[], index=i)
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
            _rule(rule_id="r1", action="ALLOW", protocol="tcp", port_ranges=["80"], index=100),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["443"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_return_traffic_rule_not_flagged_as_allow_all_external(self) -> None:
        rules = [_rule(name="Allow Return Traffic", protocol="all")]
        result = analyze_zone_pair(rules, "External", "LAN")
        assert not any(f.id == "allow-all-external" for f in result.findings)

    def test_return_traffic_rule_not_flagged_as_allow_all_protocols(self) -> None:
        rules = [_rule(name="Allow Return Traffic", protocol="all")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "allow-all-protocols-ports" for f in result.findings)

    def test_return_traffic_rule_not_flagged_as_external_to_internal(self) -> None:
        rules = [_rule(name="Allow Return Traffic", protocol="tcp", port_ranges=["80"])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert not any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_connection_state_return_rule_not_flagged_as_external_to_internal(self) -> None:
        rules = [_rule(name="Allow App", protocol="tcp", port_ranges=["80"], connection_state_type="established")]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert not any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_established_keyword_detected(self) -> None:
        rules = [_rule(name="Allow Established", protocol="all")]
        result = analyze_zone_pair(rules, "External", "LAN")
        assert not any(f.id == "allow-all-external" for f in result.findings)

    def test_related_keyword_detected(self) -> None:
        rules = [_rule(name="Allow Related Sessions", protocol="all")]
        result = analyze_zone_pair(rules, "External", "LAN")
        assert not any(f.id == "allow-all-external" for f in result.findings)

    def test_non_return_traffic_still_flagged(self) -> None:
        rules = [_rule(name="Allow All Traffic", protocol="all")]
        result = analyze_zone_pair(rules, "External", "DMZ")
        assert any(f.id == "allow-all-external" for f in result.findings)

    def test_stateful_name_is_not_treated_as_return_traffic(self) -> None:
        rules = [_rule(name="Allow Stateful App", protocol="all")]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_no_shadow_when_earlier_has_ip_ranges(self) -> None:
        """Earlier rule with ip_ranges does not shadow a later rule."""
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="all",
                port_ranges=[],
                ip_ranges=["10.0.0.0/8"],
                index=100,
            ),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_source_ip_ranges(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="all",
                source_ip_ranges=["10.0.0.5"],
                index=100,
            ),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_destination_network(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="all",
                destination_network_id="net-dmz",
                index=100,
            ),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_connection_state_restriction(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="all",
                connection_state_type="established",
                index=100,
            ),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_shadow_when_earlier_port_range_covers_later_port(self) -> None:
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="tcp", port_ranges=["1-1024"], index=100),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "shadowed-rule" and f.rule_id == "r2" for f in result.findings)

    def test_no_shadow_when_earlier_port_restriction_does_not_cover_unrestricted_later(self) -> None:
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="tcp", port_ranges=["80"], index=100),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=[], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_invalid_port_constraint(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="tcp",
                destination_port_group_members=["abc"],
                index=100,
            ),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_invalid_port_range(self) -> None:
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="tcp", port_ranges=["100-10"], index=100),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_malformed_port_range(self) -> None:
        rules = [
            _rule(rule_id="r1", action="ALLOW", protocol="tcp", port_ranges=["abc-def"], index=100),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_no_shadow_when_earlier_has_blank_port_constraint(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="tcp",
                destination_port_group_members=[" "],
                index=100,
            ),
            _rule(rule_id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_shadow_when_matching_source_ip_restrictions(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="all",
                source_ip_ranges=["10.0.0.5"],
                index=100,
            ),
            _rule(
                rule_id="r2",
                action="ALLOW",
                protocol="tcp",
                port_ranges=["80"],
                source_ip_ranges=["10.0.0.5"],
                index=200,
            ),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "shadowed-rule" and f.rule_id == "r2" for f in result.findings)

    def test_shadow_when_matching_destination_network(self) -> None:
        rules = [
            _rule(
                rule_id="r1",
                action="ALLOW",
                protocol="all",
                destination_network_id="net-dmz",
                index=100,
            ),
            _rule(
                rule_id="r2",
                action="ALLOW",
                protocol="tcp",
                port_ranges=["80"],
                destination_network_id="net-dmz",
                index=200,
            ),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "shadowed-rule" and f.rule_id == "r2" for f in result.findings)

    def test_unrestricted_external_to_internal_reports_specific_findings(self) -> None:
        rules = [_rule(name="Allow All Inbound", protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert [f.id for f in result.findings] == ["allow-external-to-internal", "no-connection-state"]
        assert result.score == 70

    def test_findings_have_rationale(self) -> None:
        """All findings from the analyzer should have a non-empty rationale."""
        rules = [_rule(protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "External", "Internal")
        for finding in result.findings:
            assert finding.rationale, f"Finding '{finding.id}' has no rationale"


class TestNoConnectionState:
    def test_allow_without_state_tracking(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"])]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert any(f.id == "no-connection-state" for f in result.findings)

    def test_allow_with_state_tracking_no_finding(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"], connection_state_type="new")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "no-connection-state" for f in result.findings)

    def test_return_traffic_rule_not_flagged(self) -> None:
        rules = [_rule(name="Allow Return Traffic", action="ALLOW", protocol="all")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "no-connection-state" for f in result.findings)

    def test_established_state_not_flagged(self) -> None:
        rules = [_rule(action="ALLOW", protocol="all", connection_state_type="established")]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "no-connection-state" for f in result.findings)

    def test_block_rule_not_flagged(self) -> None:
        rules = [_rule(action="BLOCK", protocol="tcp", port_ranges=["80"])]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "no-connection-state" for f in result.findings)

    def test_disabled_rule_not_flagged(self) -> None:
        rules = [_rule(enabled=False, action="ALLOW", protocol="tcp", port_ranges=["443"])]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        assert not any(f.id == "no-connection-state" for f in result.findings)

    def test_severity_is_high(self) -> None:
        rules = [_rule(action="ALLOW", protocol="tcp", port_ranges=["443"])]
        result = analyze_zone_pair(rules, "LAN", "DMZ")
        finding = next(f for f in result.findings if f.id == "no-connection-state")
        assert finding.severity == "high"
