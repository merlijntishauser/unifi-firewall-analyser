from unittest.mock import patch

import pytest

from app.config import UnifiCredentials
from app.services.firewall_writer import WriteError, swap_policy_order, toggle_policy


def _creds() -> UnifiCredentials:
    return UnifiCredentials(
        url="https://192.168.1.1",
        username="admin",
        password="secret",
        site="default",
        verify_ssl=False,
    )


class TestWriteErrorAlias:
    def test_write_error_is_unifi_write_error(self) -> None:
        from unifi_topology import UnifiWriteError

        assert WriteError is UnifiWriteError

    def test_write_error_is_catchable(self) -> None:
        with pytest.raises(WriteError):
            raise WriteError("test")


class TestTogglePolicy:
    def test_calls_upstream_with_correct_args(self) -> None:
        with patch("app.services.firewall_writer._toggle_upstream") as mock:
            toggle_policy(_creds(), "policy-1", enabled=True)

        mock.assert_called_once()
        call_args = mock.call_args
        config = call_args[0][0]
        assert config.url == "https://192.168.1.1"
        assert config.user == "admin"
        assert config.password == "secret"
        assert call_args[0][1] == "policy-1"
        assert call_args[1]["enabled"] is True
        assert call_args[1]["site"] == "default"

    def test_disable_passes_enabled_false(self) -> None:
        with patch("app.services.firewall_writer._toggle_upstream") as mock:
            toggle_policy(_creds(), "policy-1", enabled=False)

        assert mock.call_args[1]["enabled"] is False

    def test_propagates_upstream_error(self) -> None:
        with (
            patch("app.services.firewall_writer._toggle_upstream", side_effect=WriteError("PUT failed")),
            pytest.raises(WriteError, match="PUT failed"),
        ):
            toggle_policy(_creds(), "policy-1", enabled=True)

    def test_converts_credentials_to_config(self) -> None:
        creds = UnifiCredentials(
            url="https://10.0.0.1",
            username="user2",
            password="pass2",
            site="site2",
            verify_ssl=True,
        )
        with patch("app.services.firewall_writer._toggle_upstream") as mock:
            toggle_policy(creds, "p1", enabled=False)

        config = mock.call_args[0][0]
        assert config.url == "https://10.0.0.1"
        assert config.user == "user2"
        assert config.password == "pass2"
        assert config.verify_ssl is True
        assert mock.call_args[1]["site"] == "site2"


class TestSwapPolicyOrder:
    def test_calls_upstream_with_correct_args(self) -> None:
        with patch("app.services.firewall_writer._swap_upstream") as mock:
            swap_policy_order(_creds(), "policy-a", "policy-b")

        mock.assert_called_once()
        call_args = mock.call_args
        config = call_args[0][0]
        assert config.url == "https://192.168.1.1"
        assert call_args[0][1] == "policy-a"
        assert call_args[0][2] == "policy-b"
        assert call_args[1]["site"] == "default"

    def test_propagates_upstream_error(self) -> None:
        with (
            patch("app.services.firewall_writer._swap_upstream", side_effect=WriteError("Policy not found")),
            pytest.raises(WriteError, match="Policy not found"),
        ):
            swap_policy_order(_creds(), "policy-a", "policy-b")
