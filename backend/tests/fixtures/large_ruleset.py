"""Large ruleset with multiple zone pairs for comprehensive regression testing."""

from typing import Any

ZONES: list[dict[str, object]] = [
    {"id": "zone-lan", "name": "LAN", "networks": [{"id": "net-lan", "name": "LAN", "subnet": "192.168.1.0/24"}]},
    {
        "id": "zone-server",
        "name": "Servers",
        "networks": [{"id": "net-srv", "name": "Servers", "subnet": "10.0.10.0/24"}],
    },
    {"id": "zone-iot", "name": "IoT", "networks": [{"id": "net-iot", "name": "IoT", "subnet": "10.0.200.0/24"}]},
    {
        "id": "zone-guest",
        "name": "Guest",
        "networks": [{"id": "net-guest", "name": "Guest", "subnet": "10.0.100.0/24"}],
    },
    {"id": "zone-wan", "name": "WAN", "networks": [{"id": "net-wan", "name": "WAN", "subnet": None}]},
]

RULES: list[dict[str, object]] = [
    # LAN -> Servers: tight, well-configured
    {
        "id": "r-lan-srv-https",
        "name": "LAN to Servers HTTPS",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-lan",
        "destination_zone_id": "zone-server",
        "protocol": "tcp",
        "port_ranges": ["443"],
        "index": 100,
        "connection_state_type": "new",
        "connection_logging": True,
    },
    {
        "id": "r-lan-srv-ssh",
        "name": "LAN to Servers SSH",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-lan",
        "destination_zone_id": "zone-server",
        "protocol": "tcp",
        "port_ranges": ["22"],
        "index": 110,
        "connection_state_type": "new",
        "connection_logging": True,
    },
    {
        "id": "r-lan-srv-block",
        "name": "Block remaining LAN to Servers",
        "enabled": True,
        "action": "BLOCK",
        "source_zone_id": "zone-lan",
        "destination_zone_id": "zone-server",
        "protocol": "all",
        "index": 199,
        "connection_logging": True,
    },
    # IoT -> WAN: permissive
    {
        "id": "r-iot-wan-all",
        "name": "Allow IoT to WAN all",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-iot",
        "destination_zone_id": "zone-wan",
        "protocol": "all",
        "index": 300,
    },
    # Guest -> WAN: web only
    {
        "id": "r-guest-wan-web",
        "name": "Guest Web Access",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-guest",
        "destination_zone_id": "zone-wan",
        "protocol": "tcp",
        "port_ranges": ["80", "443"],
        "index": 400,
        "connection_state_type": "new",
        "connection_logging": True,
    },
    {
        "id": "r-guest-wan-dns",
        "name": "Guest DNS",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-guest",
        "destination_zone_id": "zone-wan",
        "protocol": "udp",
        "port_ranges": ["53"],
        "index": 410,
        "connection_state_type": "new",
        "connection_logging": True,
    },
    {
        "id": "r-guest-wan-block",
        "name": "Block remaining Guest to WAN",
        "enabled": True,
        "action": "BLOCK",
        "source_zone_id": "zone-guest",
        "destination_zone_id": "zone-wan",
        "protocol": "all",
        "index": 499,
        "connection_logging": True,
    },
    # Guest -> LAN: block
    {
        "id": "r-guest-lan-block",
        "name": "Block Guest to LAN",
        "enabled": True,
        "action": "BLOCK",
        "source_zone_id": "zone-guest",
        "destination_zone_id": "zone-lan",
        "protocol": "all",
        "index": 500,
        "connection_logging": True,
    },
    # IoT -> LAN: block
    {
        "id": "r-iot-lan-block",
        "name": "Block IoT to LAN",
        "enabled": True,
        "action": "BLOCK",
        "source_zone_id": "zone-iot",
        "destination_zone_id": "zone-lan",
        "protocol": "all",
        "index": 600,
        "connection_logging": True,
    },
]

# Per-zone-pair expected analysis results
ZONE_PAIR_TESTS: list[dict[str, Any]] = [
    {
        "src_zone_id": "zone-lan",
        "dst_zone_id": "zone-server",
        "expected_findings": [],
        "expected_grade": "A",
    },
    {
        "src_zone_id": "zone-iot",
        "dst_zone_id": "zone-wan",
        "expected_findings": ["allow-all-protocols-ports", "no-connection-state"],
        "expected_grade": "C",
    },
    {
        "src_zone_id": "zone-guest",
        "dst_zone_id": "zone-wan",
        "expected_findings": [],
        "expected_grade": "A",
    },
    {
        "src_zone_id": "zone-guest",
        "dst_zone_id": "zone-lan",
        "expected_findings": [],
        "expected_grade": "A",
    },
    {
        "src_zone_id": "zone-iot",
        "dst_zone_id": "zone-lan",
        "expected_findings": [],
        "expected_grade": "A",
    },
]

EXPECTED_SIMULATIONS: list[dict[str, object]] = [
    {
        "source_ip": "192.168.1.50",
        "destination_ip": "10.0.10.5",
        "protocol": "tcp",
        "port": 443,
        "expected_verdict": "ALLOW",
    },
    {
        "source_ip": "192.168.1.50",
        "destination_ip": "10.0.10.5",
        "protocol": "tcp",
        "port": 3306,
        "expected_verdict": "BLOCK",
    },
    {
        "source_ip": "10.0.200.50",
        "destination_ip": "192.168.1.5",
        "protocol": "tcp",
        "port": 80,
        "expected_verdict": "BLOCK",
    },
    {
        "source_ip": "10.0.100.50",
        "destination_ip": "192.168.1.5",
        "protocol": "tcp",
        "port": 443,
        "expected_verdict": "BLOCK",
    },
]
