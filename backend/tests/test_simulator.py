from app.models import Network, Rule, Zone
from app.services.simulator import _port_matches, _protocol_matches, evaluate_rules, resolve_zone


def _make_zones() -> list[Zone]:
    return [
        Zone(
            id="zone-internal",
            name="Internal",
            networks=[
                Network(id="net-lan", name="LAN", vlan_id=1, subnet="192.168.1.0/24"),
            ],
        ),
        Zone(
            id="zone-guest",
            name="Guest",
            networks=[
                Network(id="net-guest", name="Guest WiFi", vlan_id=100, subnet="10.0.100.0/24"),
            ],
        ),
        Zone(
            id="zone-iot",
            name="IoT",
            networks=[
                Network(id="net-iot", name="IoT Devices", vlan_id=200, subnet="10.0.200.0/24"),
            ],
        ),
        Zone(
            id="zone-external",
            name="External",
            networks=[
                Network(id="net-wan", name="WAN", subnet=None),
            ],
        ),
    ]


def _make_rules() -> list[Rule]:
    return [
        Rule(
            id="rule-allow-lan-wan",
            name="Allow LAN to WAN",
            enabled=True,
            action="ALLOW",
            source_zone_id="zone-internal",
            destination_zone_id="zone-external",
            index=100,
        ),
        Rule(
            id="rule-block-iot-lan",
            name="Block IoT to LAN",
            enabled=True,
            action="BLOCK",
            source_zone_id="zone-iot",
            destination_zone_id="zone-internal",
            index=200,
        ),
        Rule(
            id="rule-allow-guest-web",
            name="Allow Guest Web",
            enabled=True,
            action="ALLOW",
            source_zone_id="zone-guest",
            destination_zone_id="zone-external",
            protocol="tcp",
            port_ranges=["80", "443"],
            index=300,
        ),
        Rule(
            id="rule-disabled",
            name="Disabled Rule",
            enabled=False,
            action="ALLOW",
            source_zone_id="zone-guest",
            destination_zone_id="zone-internal",
            index=400,
        ),
        Rule(
            id="rule-allow-guest-dns",
            name="Allow Guest DNS",
            enabled=True,
            action="ALLOW",
            source_zone_id="zone-guest",
            destination_zone_id="zone-external",
            protocol="udp",
            port_ranges=["53"],
            index=310,
        ),
    ]


class TestResolveZone:
    def test_resolve_zone_by_subnet(self) -> None:
        zones = _make_zones()
        assert resolve_zone("192.168.1.50", zones) == "zone-internal"
        assert resolve_zone("10.0.100.15", zones) == "zone-guest"
        assert resolve_zone("10.0.200.99", zones) == "zone-iot"

    def test_resolve_zone_unknown_ip(self) -> None:
        zones = _make_zones()
        assert resolve_zone("8.8.8.8", zones) is None
        assert resolve_zone("172.16.0.1", zones) is None

    def test_resolve_zone_invalid_ip(self) -> None:
        zones = _make_zones()
        assert resolve_zone("not-an-ip", zones) is None

    def test_resolve_zone_network_boundary(self) -> None:
        zones = _make_zones()
        # First usable address in LAN subnet
        assert resolve_zone("192.168.1.0", zones) == "zone-internal"
        # Last address in LAN subnet
        assert resolve_zone("192.168.1.255", zones) == "zone-internal"
        # Just outside the subnet
        assert resolve_zone("192.168.2.1", zones) is None


class TestEvaluateRules:
    def test_evaluate_rules_match_allow(self) -> None:
        rules = _make_rules()
        result = evaluate_rules(rules, "zone-internal", "zone-external")

        assert result.verdict == "ALLOW"
        assert result.matched_rule_id == "rule-allow-lan-wan"
        assert result.matched_rule_name == "Allow LAN to WAN"
        assert result.default_policy_used is False

    def test_evaluate_rules_block(self) -> None:
        rules = _make_rules()
        result = evaluate_rules(rules, "zone-iot", "zone-internal")

        assert result.verdict == "BLOCK"
        assert result.matched_rule_id == "rule-block-iot-lan"
        assert result.matched_rule_name == "Block IoT to LAN"
        assert result.default_policy_used is False

    def test_evaluate_rules_protocol_port_match(self) -> None:
        rules = _make_rules()
        result = evaluate_rules(
            rules, "zone-guest", "zone-external", protocol="tcp", port=443
        )

        assert result.verdict == "ALLOW"
        assert result.matched_rule_id == "rule-allow-guest-web"
        assert result.matched_rule_name == "Allow Guest Web"

    def test_evaluate_rules_protocol_port_no_match(self) -> None:
        """TCP port 8080 should not match the guest web rule (ports 80, 443)."""
        rules = _make_rules()
        result = evaluate_rules(
            rules, "zone-guest", "zone-external", protocol="tcp", port=8080
        )

        # Should not match rule-allow-guest-web (wrong port)
        # Should not match rule-allow-guest-dns (wrong protocol)
        # Falls through to default policy
        assert result.verdict == "BLOCK"
        assert result.default_policy_used is True

    def test_evaluate_rules_udp_protocol_match(self) -> None:
        rules = _make_rules()
        result = evaluate_rules(
            rules, "zone-guest", "zone-external", protocol="udp", port=53
        )

        assert result.verdict == "ALLOW"
        assert result.matched_rule_id == "rule-allow-guest-dns"

    def test_evaluate_rules_disabled_skipped(self) -> None:
        rules = _make_rules()
        result = evaluate_rules(rules, "zone-guest", "zone-internal")

        # The only rule for guest->internal is disabled
        assert result.verdict == "BLOCK"
        assert result.default_policy_used is True

        # The disabled rule should appear in evaluations
        disabled_evals = [e for e in result.evaluations if e.skipped_disabled]
        assert len(disabled_evals) == 1
        assert disabled_evals[0].rule_id == "rule-disabled"
        assert disabled_evals[0].matched is False

    def test_evaluate_rules_no_match_default_policy(self) -> None:
        rules = _make_rules()
        # No rules exist for iot -> guest
        result = evaluate_rules(rules, "zone-iot", "zone-guest")

        assert result.verdict == "BLOCK"
        assert result.matched_rule_id is None
        assert result.matched_rule_name is None
        assert result.default_policy_used is True
        assert result.evaluations == []

    def test_evaluate_rules_respects_index_order(self) -> None:
        """Rules with lower index should be evaluated first."""
        rules = [
            Rule(
                id="rule-high-index",
                name="Allow (high index)",
                enabled=True,
                action="ALLOW",
                source_zone_id="zone-a",
                destination_zone_id="zone-b",
                index=500,
            ),
            Rule(
                id="rule-low-index",
                name="Block (low index)",
                enabled=True,
                action="BLOCK",
                source_zone_id="zone-a",
                destination_zone_id="zone-b",
                index=100,
            ),
        ]
        result = evaluate_rules(rules, "zone-a", "zone-b")

        # Even though ALLOW was listed first, BLOCK has lower index
        assert result.verdict == "BLOCK"
        assert result.matched_rule_id == "rule-low-index"

    def test_evaluate_rules_port_range(self) -> None:
        rules = [
            Rule(
                id="rule-port-range",
                name="Allow high ports",
                enabled=True,
                action="ALLOW",
                source_zone_id="zone-a",
                destination_zone_id="zone-b",
                protocol="tcp",
                port_ranges=["8000-9000"],
                index=100,
            ),
        ]
        result = evaluate_rules(rules, "zone-a", "zone-b", protocol="tcp", port=8500)
        assert result.verdict == "ALLOW"
        assert result.matched_rule_id == "rule-port-range"

        result2 = evaluate_rules(rules, "zone-a", "zone-b", protocol="tcp", port=7999)
        assert result2.verdict == "BLOCK"
        assert result2.default_policy_used is True

    def test_evaluate_rules_non_match_includes_reasons(self) -> None:
        """Non-matching rules should include mismatch reasons in evaluations."""
        rules = [
            Rule(
                id="rule-tcp-only",
                name="TCP only",
                enabled=True,
                action="ALLOW",
                source_zone_id="zone-a",
                destination_zone_id="zone-b",
                protocol="tcp",
                port_ranges=["80"],
                index=100,
            ),
        ]
        result = evaluate_rules(rules, "zone-a", "zone-b", protocol="udp", port=53)
        assert result.verdict == "BLOCK"
        assert result.default_policy_used is True
        assert len(result.evaluations) == 1
        assert "protocol mismatch" in result.evaluations[0].reason
        assert "port mismatch" in result.evaluations[0].reason

    def test_evaluate_rules_protocol_mismatch_only(self) -> None:
        """When protocol mismatches but port matches, only protocol reason is listed."""
        rules = [
            Rule(
                id="rule-tcp-80",
                name="TCP 80",
                enabled=True,
                action="ALLOW",
                source_zone_id="zone-a",
                destination_zone_id="zone-b",
                protocol="tcp",
                port_ranges=["80"],
                index=100,
            ),
        ]
        result = evaluate_rules(rules, "zone-a", "zone-b", protocol="udp", port=80)
        assert result.verdict == "BLOCK"
        assert len(result.evaluations) == 1
        assert "protocol mismatch" in result.evaluations[0].reason
        assert "port mismatch" not in result.evaluations[0].reason


class TestProtocolMatches:
    def test_all_matches_everything(self) -> None:
        assert _protocol_matches("all", "tcp") is True
        assert _protocol_matches("all", None) is True

    def test_none_protocol_matches_specific_rule(self) -> None:
        assert _protocol_matches("tcp", None) is True

    def test_exact_match(self) -> None:
        assert _protocol_matches("tcp", "tcp") is True
        assert _protocol_matches("tcp", "TCP") is True

    def test_no_match(self) -> None:
        assert _protocol_matches("tcp", "udp") is False


class TestPortMatches:
    def test_no_port_ranges_matches_all(self) -> None:
        assert _port_matches([], 80) is True
        assert _port_matches([], None) is True

    def test_port_restriction_with_no_packet_port(self) -> None:
        assert _port_matches(["80"], None) is False

    def test_invalid_port_range_skipped(self) -> None:
        assert _port_matches(["abc-def"], 80) is False

    def test_invalid_single_port_skipped(self) -> None:
        assert _port_matches(["abc"], 80) is False


class TestResolveZoneEdgeCases:
    def test_invalid_subnet_skipped(self) -> None:
        zones = [
            Zone(
                id="zone-bad",
                name="Bad",
                networks=[Network(id="net-bad", name="Bad", subnet="not-a-subnet")],
            ),
        ]
        assert resolve_zone("192.168.1.1", zones) is None
