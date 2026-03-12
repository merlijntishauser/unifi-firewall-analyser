"""Rules with address groups, schedules. Grade A-B range."""

ZONES: list[dict[str, object]] = [
    {"id": "zone-a", "name": "LAN", "networks": [{"id": "net-a", "name": "LAN", "subnet": "192.168.1.0/24"}]},
    {"id": "zone-b", "name": "DMZ", "networks": [{"id": "net-b", "name": "DMZ", "subnet": "10.0.50.0/24"}]},
]

RULES: list[dict[str, object]] = [
    {
        "id": "r-broad-group",
        "name": "Allow via broad group",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-a",
        "destination_zone_id": "zone-b",
        "protocol": "tcp",
        "port_ranges": ["443"],
        "index": 100,
        "source_address_group": "AllHosts",
        "source_address_group_members": ["0.0.0.0/0"],
        "connection_state_type": "new",
        "connection_logging": True,
    },
    {
        "id": "r-scheduled",
        "name": "Allow scheduled access",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-a",
        "destination_zone_id": "zone-b",
        "protocol": "tcp",
        "port_ranges": ["8080"],
        "index": 200,
        "schedule": "office-hours",
        "connection_state_type": "new",
        "connection_logging": True,
    },
]

# r-broad-group: broad-address-group (medium, -8)
# r-scheduled: schedule-dependent-allow (low, -2)
# Score: 100 - 8 - 2 = 90 = A
EXPECTED_FINDINGS: list[str] = ["broad-address-group", "schedule-dependent-allow"]
EXPECTED_GRADE_MIN = "A"
EXPECTED_GRADE_MAX = "A"

EXPECTED_SIMULATIONS: list[dict[str, object]] = [
    {
        "source_ip": "192.168.1.50",
        "destination_ip": "10.0.50.5",
        "protocol": "tcp",
        "port": 443,
        "expected_verdict": "ALLOW",
    },
    {
        "source_ip": "192.168.1.50",
        "destination_ip": "10.0.50.5",
        "protocol": "tcp",
        "port": 8080,
        "expected_verdict": "ALLOW",
        "expect_unresolvable": True,
    },
]
