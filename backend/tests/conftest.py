from collections.abc import Iterator
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import clear_runtime_credentials
from app.main import app

# Raw API responses matching what unifi-topology returns before normalization
MOCK_RAW_ZONES = [
    {"_id": "zone-external", "name": "External", "networkIds": []},
    {"_id": "zone-internal", "name": "Internal", "networkIds": ["net-lan"]},
    {"_id": "zone-guest", "name": "Guest", "networkIds": ["net-guest"]},
    {"_id": "zone-iot", "name": "IoT", "networkIds": ["net-iot"]},
    {"_id": "zone-vpn", "name": "VPN", "networkIds": ["net-vpn"]},
    {"_id": "zone-gateway", "name": "Gateway", "networkIds": ["net-gw"]},
]

MOCK_RAW_POLICIES = [
    {
        "_id": "rule-1",
        "name": "Allow LAN to Internet",
        "description": "Allow all traffic from LAN to WAN",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-internal",
        "destination_zone_id": "zone-external",
        "index": 100,
    },
    {
        "_id": "rule-2",
        "name": "Allow Guest Web Access",
        "description": "Allow Guest zone to access web on WAN",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-guest",
        "destination_zone_id": "zone-external",
        "protocol": "tcp",
        "port_ranges": ["80", "443"],
        "index": 200,
    },
    {
        "_id": "rule-3",
        "name": "Allow Guest DNS",
        "description": "Allow Guest zone to resolve DNS",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-guest",
        "destination_zone_id": "zone-external",
        "protocol": "udp",
        "port_ranges": ["53"],
        "index": 210,
    },
    {
        "_id": "rule-4",
        "name": "Block Guest Other Traffic",
        "description": "Block all other Guest traffic to WAN",
        "enabled": True,
        "action": "BLOCK",
        "source_zone_id": "zone-guest",
        "destination_zone_id": "zone-external",
        "index": 290,
    },
    {
        "_id": "rule-5",
        "name": "Block IoT to LAN",
        "description": "Prevent IoT devices from reaching LAN",
        "enabled": True,
        "action": "BLOCK",
        "source_zone_id": "zone-iot",
        "destination_zone_id": "zone-internal",
        "index": 300,
    },
    {
        "_id": "rule-6",
        "name": "Allow IoT to Internet",
        "description": "Allow IoT devices to reach the internet",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-iot",
        "destination_zone_id": "zone-external",
        "index": 310,
    },
    {
        "_id": "rule-7",
        "name": "Block Guest to LAN",
        "description": "Prevent Guest from reaching LAN",
        "enabled": True,
        "action": "BLOCK",
        "source_zone_id": "zone-guest",
        "destination_zone_id": "zone-internal",
        "index": 400,
    },
    {
        "_id": "rule-8",
        "name": "Allow VPN to LAN",
        "description": "Allow VPN clients to access LAN resources",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-vpn",
        "destination_zone_id": "zone-internal",
        "index": 500,
    },
    {
        "_id": "rule-9",
        "name": "Allow LAN to IoT",
        "description": "Allow LAN to manage IoT devices",
        "enabled": True,
        "action": "ALLOW",
        "source_zone_id": "zone-internal",
        "destination_zone_id": "zone-iot",
        "index": 600,
    },
    {
        "_id": "rule-10",
        "name": "Allow LAN to Gateway SSH",
        "description": "Allow SSH access to gateway from LAN",
        "enabled": False,
        "action": "ALLOW",
        "source_zone_id": "zone-internal",
        "destination_zone_id": "zone-gateway",
        "protocol": "tcp",
        "port_ranges": ["22"],
        "index": 700,
    },
    {
        "_id": "rule-predefined-1",
        "name": "Block WAN to LAN",
        "description": "Default block inbound from WAN",
        "enabled": True,
        "action": "BLOCK",
        "source_zone_id": "zone-external",
        "destination_zone_id": "zone-internal",
        "index": 9000,
        "predefined": True,
    },
]

MOCK_RAW_NETWORKS = [
    {"_id": "net-wan", "name": "WAN", "purpose": "wan"},
    {
        "_id": "net-lan",
        "name": "LAN",
        "vlan": 1,
        "vlan_enabled": True,
        "ip_subnet": "192.168.1.0/24",
    },
    {
        "_id": "net-guest",
        "name": "Guest WiFi",
        "vlan": 100,
        "vlan_enabled": True,
        "ip_subnet": "10.0.100.0/24",
    },
    {
        "_id": "net-iot",
        "name": "IoT Devices",
        "vlan": 200,
        "vlan_enabled": True,
        "ip_subnet": "10.0.200.0/24",
    },
    {
        "_id": "net-vpn",
        "name": "VPN Clients",
        "ip_subnet": "10.10.0.0/24",
    },
    {
        "_id": "net-gw",
        "name": "Gateway",
        "ip_subnet": "192.168.1.1/32",
    },
]


@pytest.fixture(autouse=True)
def _clean_credentials() -> Iterator[None]:
    """Ensure all credentials (runtime and env-based) are cleared for each test."""
    clear_runtime_credentials()
    with (
        patch("app.config.settings.unifi_url", ""),
        patch("app.config.settings.unifi_user", ""),
        patch("app.config.settings.unifi_pass", ""),
    ):
        yield
    clear_runtime_credentials()


@pytest.fixture(autouse=True)
def _mock_unifi_topology() -> Iterator[None]:
    """Mock unifi-topology API calls so tests don't need a real controller."""
    with (
        patch(
            "app.services.firewall.fetch_firewall_zones",
            return_value=MOCK_RAW_ZONES,
        ),
        patch(
            "app.services.firewall.fetch_firewall_policies",
            return_value=MOCK_RAW_POLICIES,
        ),
        patch(
            "app.services.firewall.fetch_networks",
            return_value=MOCK_RAW_NETWORKS,
        ),
    ):
        yield


@pytest.fixture
async def client() -> AsyncClient:  # type: ignore[misc]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac  # type: ignore[misc]
