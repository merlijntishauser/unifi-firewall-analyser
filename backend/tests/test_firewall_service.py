from unittest.mock import patch

from unifi_topology import Config

from app.services.firewall import _build_network_lookup


def _config() -> Config:
    return Config(url="https://x", site="default", user="u", password="p", verify_ssl=False)


class TestBuildNetworkLookup:
    def test_non_dict_entries_are_skipped(self) -> None:
        with patch("app.services.firewall.fetch_networks", return_value=["not-a-dict", 42]):
            lookup = _build_network_lookup(_config())
        assert lookup == {}

    def test_dict_without_id_is_skipped(self) -> None:
        with patch("app.services.firewall.fetch_networks", return_value=[{"name": "orphan"}]):
            lookup = _build_network_lookup(_config())
        assert lookup == {}
