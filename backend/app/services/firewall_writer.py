"""Write operations for UniFi firewall policies.

Thin wrapper around unifi-topology write operations, converting
between analyser credentials and topology Config.
"""

from __future__ import annotations

from unifi_topology import UnifiWriteError
from unifi_topology import swap_firewall_policy_order as _swap_upstream
from unifi_topology import toggle_firewall_policy as _toggle_upstream

from app.config import UnifiCredentials
from app.services.firewall import to_topology_config

# Re-export for backward compatibility with router imports
WriteError = UnifiWriteError


def toggle_policy(
    credentials: UnifiCredentials,
    policy_id: str,
    *,
    enabled: bool,
) -> None:
    """Toggle a firewall policy's enabled state."""
    config = to_topology_config(credentials)
    _toggle_upstream(config, policy_id, enabled=enabled, site=credentials.site)


def swap_policy_order(
    credentials: UnifiCredentials,
    policy_id_a: str,
    policy_id_b: str,
) -> None:
    """Swap the index (priority) of two firewall policies."""
    config = to_topology_config(credentials)
    _swap_upstream(config, policy_id_a, policy_id_b, site=credentials.site)
