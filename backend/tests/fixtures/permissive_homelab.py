"""Permissive homelab -- broad allows, no state tracking. Grade C."""

ZONES: list[dict[str, object]] = [
    {"id": "zone-lan", "name": "LAN", "networks": [{"id": "net-lan", "name": "LAN", "subnet": "192.168.1.0/24"}]},
    {"id": "zone-iot", "name": "IoT", "networks": [{"id": "net-iot", "name": "IoT", "subnet": "10.0.200.0/24"}]},
    {
        "id": "zone-guest",
        "name": "Guest",
        "networks": [{"id": "net-guest", "name": "Guest", "subnet": "10.0.100.0/24"}],
    },
    {"id": "zone-wan", "name": "WAN", "networks": [{"id": "net-wan", "name": "WAN", "subnet": None}]},
]

RULES: list[dict[str, object]] = [
    {
        "id": "r-lan-iot",
        "name": "Allow LAN to IoT all",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-lan",
        "destination_zone_id": "zone-iot",
        "protocol": "all",
        "index": 100,
    },
    {
        "id": "r-iot-lan",
        "name": "Allow IoT to LAN all",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-iot",
        "destination_zone_id": "zone-lan",
        "protocol": "all",
        "index": 200,
    },
]

# Each zone pair has 1 rule generating allow-all-protocols-ports + no-connection-state
# Score per pair: 100 - 15 - 15 = 70 = grade C
EXPECTED_FINDINGS: list[str] = ["allow-all-protocols-ports", "no-connection-state"]
EXPECTED_GRADE_MIN = "C"
EXPECTED_GRADE_MAX = "C"

EXPECTED_SIMULATIONS: list[dict[str, object]] = [
    {
        "source_ip": "192.168.1.50",
        "destination_ip": "10.0.200.5",
        "expected_verdict": "ALLOW",
    },
]
