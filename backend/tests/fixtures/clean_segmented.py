"""Clean segmented network -- tight rules, state tracking, logging. Grade A, no findings."""

ZONES: list[dict[str, object]] = [
    {"id": "zone-lan", "name": "LAN", "networks": [{"id": "net-lan", "name": "LAN", "subnet": "192.168.1.0/24"}]},
    {
        "id": "zone-server",
        "name": "Servers",
        "networks": [{"id": "net-srv", "name": "Servers", "subnet": "10.0.10.0/24"}],
    },
    {"id": "zone-wan", "name": "WAN", "networks": [{"id": "net-wan", "name": "WAN", "subnet": None}]},
]

RULES: list[dict[str, object]] = [
    {
        "id": "r-lan-web",
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
        "id": "r-lan-dns",
        "name": "LAN to Servers DNS",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-lan",
        "destination_zone_id": "zone-server",
        "protocol": "udp",
        "port_ranges": ["53"],
        "index": 200,
        "connection_state_type": "new",
        "connection_logging": True,
    },
    {
        "id": "r-block-rest",
        "name": "Block remaining LAN to Servers",
        "enabled": True,
        "action": "BLOCK",
        "source_zone_id": "zone-lan",
        "destination_zone_id": "zone-server",
        "protocol": "all",
        "index": 300,
        "connection_logging": True,
    },
]

EXPECTED_FINDINGS: list[str] = []
EXPECTED_GRADE = "A"

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
        "port": 22,
        "expected_verdict": "BLOCK",
    },
]
