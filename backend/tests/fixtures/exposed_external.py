"""External-facing with unrestricted inbound. High severity from external exposure."""

ZONES: list[dict[str, object]] = [
    {"id": "zone-wan", "name": "External", "networks": [{"id": "net-wan", "name": "WAN", "subnet": None}]},
    {"id": "zone-lan", "name": "Internal", "networks": [{"id": "net-lan", "name": "LAN", "subnet": "192.168.1.0/24"}]},
]

RULES: list[dict[str, object]] = [
    {
        "id": "r-allow-all-in",
        "name": "Allow All Inbound",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-wan",
        "destination_zone_id": "zone-lan",
        "protocol": "all",
        "index": 100,
    },
]

# _check_allow_external_to_internal fires (src=External, dst=Internal)
# _check_no_connection_state fires (no connection_state_type)
# Score: 100 - 15 - 15 = 70 = grade C
EXPECTED_FINDINGS: list[str] = ["allow-external-to-internal", "no-connection-state"]
EXPECTED_GRADE = "C"

EXPECTED_SIMULATIONS: list[dict[str, object]] = []
