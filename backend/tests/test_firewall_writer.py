from unittest.mock import MagicMock, patch

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


class TestTogglePolicy:
    def test_toggle_enables_policy(self) -> None:
        mock_session = MagicMock()
        # GET returns the policy
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = {
            "_id": "policy-1",
            "name": "Test Rule",
            "enabled": False,
            "action": "ALLOW",
            "index": 100,
        }
        # PUT returns success
        put_response = MagicMock()
        put_response.ok = True
        put_response.status_code = 200
        put_response.json.return_value = {"_id": "policy-1", "enabled": True}

        mock_session.get.return_value = get_response
        mock_session.put.return_value = put_response

        with patch("app.services.firewall_writer._get_session", return_value=mock_session):
            toggle_policy(_creds(), "policy-1", enabled=True)

        # Verify PUT was called with enabled=True
        put_call = mock_session.put.call_args
        assert put_call is not None
        payload = put_call.kwargs.get("json") or put_call[1].get("json")
        assert payload["enabled"] is True

    def test_toggle_disables_policy(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = {
            "_id": "policy-1",
            "name": "Test Rule",
            "enabled": True,
            "action": "ALLOW",
            "index": 100,
        }
        put_response = MagicMock()
        put_response.ok = True
        put_response.status_code = 200
        put_response.json.return_value = {"_id": "policy-1", "enabled": False}

        mock_session.get.return_value = get_response
        mock_session.put.return_value = put_response

        with patch("app.services.firewall_writer._get_session", return_value=mock_session):
            toggle_policy(_creds(), "policy-1", enabled=False)

        put_call = mock_session.put.call_args
        payload = put_call.kwargs.get("json") or put_call[1].get("json")
        assert payload["enabled"] is False

    def test_toggle_raises_on_get_failure(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = False
        get_response.status_code = 404
        get_response.json.return_value = {"error": "not found"}
        mock_session.get.return_value = get_response

        with (
            patch("app.services.firewall_writer._get_session", return_value=mock_session),
            pytest.raises(WriteError, match="404"),
        ):
            toggle_policy(_creds(), "policy-1", enabled=True)

    def test_toggle_raises_on_put_failure(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = {"_id": "policy-1", "enabled": True, "index": 100}
        put_response = MagicMock()
        put_response.ok = False
        put_response.status_code = 400
        put_response.json.return_value = {"error": "bad request"}
        mock_session.get.return_value = get_response
        mock_session.put.return_value = put_response

        with (
            patch("app.services.firewall_writer._get_session", return_value=mock_session),
            pytest.raises(WriteError, match="400"),
        ):
            toggle_policy(_creds(), "policy-1", enabled=False)

    def test_toggle_raises_on_expired_session(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = False
        get_response.status_code = 401
        mock_session.get.return_value = get_response

        with (
            patch("app.services.firewall_writer._get_session", return_value=mock_session),
            pytest.raises(WriteError, match="Session expired"),
        ):
            toggle_policy(_creds(), "policy-1", enabled=True)


class TestSwapPolicyOrder:
    def test_swap_exchanges_indices(self) -> None:
        mock_session = MagicMock()
        # GET returns list of policies
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = [
            {"_id": "policy-a", "name": "Rule A", "index": 100},
            {"_id": "policy-b", "name": "Rule B", "index": 200},
            {"_id": "policy-c", "name": "Rule C", "index": 300},
        ]
        put_response = MagicMock()
        put_response.ok = True
        put_response.status_code = 200

        mock_session.get.return_value = get_response
        mock_session.put.return_value = put_response

        with patch("app.services.firewall_writer._get_session", return_value=mock_session):
            swap_policy_order(_creds(), "policy-a", "policy-b")

        # Two PUT calls should have been made
        assert mock_session.put.call_count == 2
        first_put = mock_session.put.call_args_list[0]
        second_put = mock_session.put.call_args_list[1]
        first_payload = first_put.kwargs.get("json") or first_put[1].get("json")
        second_payload = second_put.kwargs.get("json") or second_put[1].get("json")
        # Indices should be swapped
        assert first_payload["index"] == 200
        assert second_payload["index"] == 100

    def test_swap_raises_when_policy_not_found(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = [
            {"_id": "policy-a", "name": "Rule A", "index": 100},
        ]
        mock_session.get.return_value = get_response

        with (
            patch("app.services.firewall_writer._get_session", return_value=mock_session),
            pytest.raises(WriteError, match="not found"),
        ):
            swap_policy_order(_creds(), "policy-a", "policy-missing")

    def test_swap_raises_on_expired_session(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = False
        get_response.status_code = 401
        mock_session.get.return_value = get_response

        with (
            patch("app.services.firewall_writer._get_session", return_value=mock_session),
            pytest.raises(WriteError, match="Session expired"),
        ):
            swap_policy_order(_creds(), "policy-a", "policy-b")


class TestGetV2:
    def test_returns_single_item_from_list(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = [{"_id": "p1", "enabled": True}]
        mock_session.get.return_value = get_response

        from app.services.firewall_writer import _get_v2

        result = _get_v2(mock_session, "https://host", "/path", verify_ssl=True)
        assert result == {"_id": "p1", "enabled": True}

    def test_raises_when_list_has_multiple_items(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = [{"_id": "p1"}, {"_id": "p2"}]
        mock_session.get.return_value = get_response

        from app.services.firewall_writer import _get_v2

        with pytest.raises(WriteError, match="Expected single policy, got 2"):
            _get_v2(mock_session, "https://host", "/path", verify_ssl=True)

    def test_returns_dict_directly(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = {"_id": "p1", "enabled": True}
        mock_session.get.return_value = get_response

        from app.services.firewall_writer import _get_v2

        result = _get_v2(mock_session, "https://host", "/path", verify_ssl=True)
        assert result == {"_id": "p1", "enabled": True}


class TestGetV2List:
    def test_returns_list_directly(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = [{"_id": "p1"}, {"_id": "p2"}]
        mock_session.get.return_value = get_response

        from app.services.firewall_writer import _get_v2_list

        result = _get_v2_list(mock_session, "https://host", "/path", verify_ssl=True)
        assert len(result) == 2

    def test_extracts_data_key_from_dict(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = {"data": [{"_id": "p1"}]}
        mock_session.get.return_value = get_response

        from app.services.firewall_writer import _get_v2_list

        result = _get_v2_list(mock_session, "https://host", "/path", verify_ssl=True)
        assert result == [{"_id": "p1"}]

    def test_raises_on_unexpected_format(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = {"unexpected": "format"}
        mock_session.get.return_value = get_response

        from app.services.firewall_writer import _get_v2_list

        with pytest.raises(WriteError, match="Unexpected response format"):
            _get_v2_list(mock_session, "https://host", "/path", verify_ssl=True)

    def test_raises_on_get_failure(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = False
        get_response.status_code = 500
        mock_session.get.return_value = get_response

        from app.services.firewall_writer import _get_v2_list

        with pytest.raises(WriteError, match="500"):
            _get_v2_list(mock_session, "https://host", "/path", verify_ssl=True)


class TestPutV2:
    def test_raises_on_expired_session(self) -> None:
        mock_session = MagicMock()
        put_response = MagicMock()
        put_response.ok = False
        put_response.status_code = 401
        mock_session.put.return_value = put_response

        from app.services.firewall_writer import _put_v2

        with pytest.raises(WriteError, match="Session expired"):
            _put_v2(mock_session, "https://host", "/path", {}, verify_ssl=True)

    def test_raises_with_text_body_on_json_parse_failure(self) -> None:
        mock_session = MagicMock()
        put_response = MagicMock()
        put_response.ok = False
        put_response.status_code = 500
        put_response.json.side_effect = ValueError("not json")
        put_response.text = "Internal Server Error"
        mock_session.put.return_value = put_response

        from app.services.firewall_writer import _put_v2

        with pytest.raises(WriteError, match="Internal Server Error"):
            _put_v2(mock_session, "https://host", "/path", {}, verify_ssl=True)


class TestSslWarnings:
    def test_disables_warnings_when_verify_ssl_false(self) -> None:
        mock_session = MagicMock()
        auth_response = MagicMock()
        auth_response.ok = True
        mock_session.post.return_value = auth_response
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = {"_id": "p1", "enabled": True, "index": 1}
        put_response = MagicMock()
        put_response.ok = True
        put_response.status_code = 200
        mock_session.get.return_value = get_response
        mock_session.put.return_value = put_response

        with (
            patch("app.services.firewall_writer.requests.Session", return_value=mock_session),
            patch("urllib3.disable_warnings") as mock_disable,
        ):
            toggle_policy(_creds(), "p1", enabled=False)

        mock_disable.assert_called_once()

    def test_skips_warning_suppression_when_verify_ssl_true(self) -> None:
        creds = UnifiCredentials(
            url="https://192.168.1.1", username="admin", password="secret", site="default", verify_ssl=True
        )
        mock_session = MagicMock()
        auth_response = MagicMock()
        auth_response.ok = True
        mock_session.post.return_value = auth_response
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = {"_id": "p1", "enabled": True, "index": 1}
        put_response = MagicMock()
        put_response.ok = True
        put_response.status_code = 200
        mock_session.get.return_value = get_response
        mock_session.put.return_value = put_response

        with (
            patch("app.services.firewall_writer.requests.Session", return_value=mock_session),
            patch("urllib3.disable_warnings") as mock_disable,
        ):
            toggle_policy(creds, "p1", enabled=False)

        mock_disable.assert_not_called()


class TestAuthentication:
    def test_toggle_authenticates_with_controller(self) -> None:
        mock_session = MagicMock()
        get_response = MagicMock()
        get_response.ok = True
        get_response.status_code = 200
        get_response.json.return_value = {"_id": "p1", "enabled": True, "index": 1}
        put_response = MagicMock()
        put_response.ok = True
        put_response.status_code = 200
        mock_session.get.return_value = get_response
        mock_session.put.return_value = put_response
        auth_response = MagicMock()
        auth_response.ok = True
        mock_session.post.return_value = auth_response

        with patch("app.services.firewall_writer.requests.Session", return_value=mock_session):
            toggle_policy(_creds(), "p1", enabled=False)

        mock_session.post.assert_called_once()
        call_args = mock_session.post.call_args
        assert "/api/auth/login" in call_args[0][0]
        payload = call_args.kwargs.get("json") or call_args[1].get("json")
        assert payload["username"] == "admin"
        assert payload["password"] == "secret"

    def test_raises_on_auth_failure(self) -> None:
        mock_session = MagicMock()
        auth_response = MagicMock()
        auth_response.ok = False
        auth_response.status_code = 401
        mock_session.post.return_value = auth_response

        with (
            patch("app.services.firewall_writer.requests.Session", return_value=mock_session),
            pytest.raises(WriteError, match="Authentication failed"),
        ):
            toggle_policy(_creds(), "p1", enabled=True)

    def test_raises_on_connection_error(self) -> None:
        import requests as req

        mock_session = MagicMock()
        mock_session.post.side_effect = req.ConnectionError("refused")

        with (
            patch("app.services.firewall_writer.requests.Session", return_value=mock_session),
            pytest.raises(WriteError, match="Authentication failed"),
        ):
            toggle_policy(_creds(), "p1", enabled=True)
