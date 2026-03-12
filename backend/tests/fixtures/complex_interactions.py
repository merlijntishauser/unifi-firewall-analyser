"""Complex rule interactions -- shadowing, disabled blocks, wide port ranges."""

ZONES: list[dict[str, object]] = [
    {"id": "zone-a", "name": "Office", "networks": [{"id": "net-a", "name": "Office", "subnet": "172.16.0.0/16"}]},
    {"id": "zone-b", "name": "DataCenter", "networks": [{"id": "net-b", "name": "DC", "subnet": "10.0.0.0/16"}]},
]

RULES: list[dict[str, object]] = [
    {
        "id": "r-allow-web",
        "name": "Allow Web Services",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-a",
        "destination_zone_id": "zone-b",
        "protocol": "tcp",
        "port_ranges": ["1-1024"],
        "index": 100,
        "connection_state_type": "new",
        "connection_logging": True,
    },
    {
        "id": "r-block-ssh",
        "name": "Block SSH",
        "enabled": True,
        "action": "BLOCK",
        "source_zone_id": "zone-a",
        "destination_zone_id": "zone-b",
        "protocol": "tcp",
        "port_ranges": ["22"],
        "index": 200,
        "connection_logging": True,
    },
    {
        "id": "r-disabled-block",
        "name": "Disabled Block All",
        "enabled": False,
        "action": "BLOCK",
        "source_zone_id": "zone-a",
        "destination_zone_id": "zone-b",
        "protocol": "all",
        "index": 300,
    },
]

# r-allow-web: wide-port-range (1-1024 = 1024 ports >= 1000)
# r-block-ssh: overlapping-allow-block (overlaps r-allow-web ports but not a full shadow
#   because r-allow-web has connection_state_type="new" while r-block-ssh has none)
# r-disabled-block: disabled-block-rule
# Score: 100 - 8 (wide-port-range) - 8 (overlapping-allow-block) - 8 (disabled-block-rule) = 76 = C
EXPECTED_FINDINGS: list[str] = ["wide-port-range", "overlapping-allow-block", "disabled-block-rule"]
EXPECTED_GRADE = "C"

EXPECTED_SIMULATIONS: list[dict[str, object]] = [
    {
        "source_ip": "172.16.1.50",
        "destination_ip": "10.0.1.5",
        "protocol": "tcp",
        "port": 443,
        "expected_verdict": "ALLOW",
    },
    {
        "source_ip": "172.16.1.50",
        "destination_ip": "10.0.1.5",
        "protocol": "tcp",
        "port": 22,
        "expected_verdict": "ALLOW",  # shadowed: allow-web at index 100 matches first
    },
]
