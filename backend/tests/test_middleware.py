"""Tests for the application middleware (auth + access logging)."""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.config import clear_runtime_credentials, set_runtime_credentials
from app.main import app
from app.middleware import COOKIE_NAME, _is_enabled, create_session_cookie


@pytest.fixture(autouse=True)
def _clean_credentials() -> Iterator[None]:
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
    with (
        patch("app.services.firewall.fetch_firewall_zones", return_value=[]),
        patch("app.services.firewall.fetch_firewall_policies", return_value=[]),
        patch("app.services.firewall.fetch_networks", return_value=[]),
        patch("app.services.firewall.fetch_firewall_groups", return_value=[]),
    ):
        yield


@pytest.fixture
async def client() -> AsyncClient:  # type: ignore[misc]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac  # type: ignore[misc]


class TestAppAuthDisabled:
    """When APP_PASSWORD is not set, all requests pass through."""

    @pytest.mark.anyio
    async def test_api_accessible_without_auth(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", ""):
            resp = await client.get("/api/health")
        assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_auth_status_not_required(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", ""):
            resp = await client.get("/api/auth/app-status")
        assert resp.status_code == 200
        assert resp.json() == {"required": False, "authenticated": False}


class TestAppAuthEnabled:
    """When APP_PASSWORD is set, API requests require a valid session cookie."""

    @pytest.mark.anyio
    async def test_api_returns_401_without_cookie(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", "secret123"):
            set_runtime_credentials(url="https://u", username="admin", password="pass")
            resp = await client.get("/api/auth/status")
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Authentication required"

    @pytest.mark.anyio
    async def test_health_bypasses_auth(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", "secret123"):
            resp = await client.get("/api/health")
        assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_app_login_bypasses_auth(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", "secret123"):
            resp = await client.post("/api/auth/app-login", json={"password": "secret123"})
        assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_app_status_bypasses_auth(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", "secret123"):
            resp = await client.get("/api/auth/app-status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["required"] is True
        assert data["authenticated"] is False

    @pytest.mark.anyio
    async def test_static_paths_bypass_auth(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", "secret123"):
            # Non-API paths (frontend static files) should not be gated
            resp = await client.get("/nonexistent.html")
        # Will be 404 (no frontend dist) but NOT 401
        assert resp.status_code != 401

    @pytest.mark.anyio
    async def test_valid_cookie_passes(self, client: AsyncClient) -> None:
        secret = "secret123"
        with patch("app.config.settings.app_password", secret):
            cookie_value, _ = create_session_cookie(secret, 86400)
            set_runtime_credentials(url="https://u", username="admin", password="pass")
            client.cookies.set(COOKIE_NAME, cookie_value)
            resp = await client.get("/api/auth/status")
        assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_invalid_cookie_returns_401(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", "secret123"):
            client.cookies.set(COOKIE_NAME, "bogus:value")
            resp = await client.get("/api/auth/status")
        assert resp.status_code == 401

    @pytest.mark.anyio
    async def test_expired_cookie_returns_401(self, client: AsyncClient) -> None:
        secret = "secret123"
        with (
            patch("app.config.settings.app_password", secret),
            patch("app.config.settings.app_session_ttl", 0),
            patch("app.middleware.time.time", return_value=1000000.0),
        ):
            cookie_value, _ = create_session_cookie(secret, 0)
        # Cookie was created at time 1000000. Now time is 1000001 and ttl is 0, so it's expired.
        with (
            patch("app.config.settings.app_password", secret),
            patch("app.config.settings.app_session_ttl", 0),
            patch("app.middleware.time.time", return_value=1000001.0),
        ):
            client.cookies.set(COOKIE_NAME, cookie_value)
            resp = await client.get("/api/auth/status")
        assert resp.status_code == 401

    @pytest.mark.anyio
    async def test_wrong_secret_cookie_returns_401(self, client: AsyncClient) -> None:
        # Create cookie with one secret, validate with another
        cookie_value, _ = create_session_cookie("old-secret", 86400)
        with patch("app.config.settings.app_password", "new-secret"):
            client.cookies.set(COOKIE_NAME, cookie_value)
            resp = await client.get("/api/auth/status")
        assert resp.status_code == 401


class TestAppLogin:
    """Tests for POST /api/auth/app-login."""

    @pytest.mark.anyio
    async def test_correct_password_sets_cookie(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", "secret123"):
            resp = await client.post("/api/auth/app-login", json={"password": "secret123"})
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
        assert COOKIE_NAME in resp.cookies

    @pytest.mark.anyio
    async def test_wrong_password_returns_401(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", "secret123"):
            resp = await client.post("/api/auth/app-login", json={"password": "wrong"})
        assert resp.status_code == 401
        assert COOKIE_NAME not in resp.cookies

    @pytest.mark.anyio
    async def test_login_disabled_returns_400(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", ""):
            resp = await client.post("/api/auth/app-login", json={"password": "anything"})
        assert resp.status_code == 400


class TestAppStatus:
    """Tests for GET /api/auth/app-status."""

    @pytest.mark.anyio
    async def test_not_required_when_no_password(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", ""):
            resp = await client.get("/api/auth/app-status")
        assert resp.json() == {"required": False, "authenticated": False}

    @pytest.mark.anyio
    async def test_required_and_authenticated_with_valid_cookie(self, client: AsyncClient) -> None:
        secret = "secret123"
        cookie_value, _ = create_session_cookie(secret, 86400)
        with patch("app.config.settings.app_password", secret):
            client.cookies.set(COOKIE_NAME, cookie_value)
            resp = await client.get("/api/auth/app-status")
        assert resp.json() == {"required": True, "authenticated": True}

    @pytest.mark.anyio
    async def test_required_not_authenticated_without_cookie(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", "secret123"):
            resp = await client.get("/api/auth/app-status")
        assert resp.json() == {"required": True, "authenticated": False}

    @pytest.mark.anyio
    async def test_required_not_authenticated_with_bad_cookie(self, client: AsyncClient) -> None:
        with patch("app.config.settings.app_password", "secret123"):
            client.cookies.set(COOKIE_NAME, "invalid")
            resp = await client.get("/api/auth/app-status")
        assert resp.json() == {"required": True, "authenticated": False}


class TestAuthE2EFlow:
    """End-to-end flow tests: login, use cookie, access API, check status."""

    @pytest.mark.anyio
    async def test_full_auth_lifecycle(self, client: AsyncClient) -> None:
        """Login -> use cookie -> check status -> access protected endpoint."""
        secret = "e2e-secret"
        with patch("app.config.settings.app_password", secret):
            # 1. Check status -- not authenticated
            status_resp = await client.get("/api/auth/app-status")
            assert status_resp.json() == {"required": True, "authenticated": False}

            # 2. Login with correct password
            login_resp = await client.post("/api/auth/app-login", json={"password": secret})
            assert login_resp.status_code == 200
            session_cookie = login_resp.cookies.get(COOKIE_NAME)
            assert session_cookie is not None

            # 3. Check status with cookie -- authenticated
            client.cookies.set(COOKIE_NAME, session_cookie)
            status_resp2 = await client.get("/api/auth/app-status")
            assert status_resp2.json() == {"required": True, "authenticated": True}

            # 4. Access protected endpoint with cookie
            set_runtime_credentials(url="https://u", username="admin", password="pass")
            auth_resp = await client.get("/api/auth/status")
            assert auth_resp.status_code == 200
            assert auth_resp.json()["configured"] is True

    @pytest.mark.anyio
    async def test_wrong_password_then_correct(self, client: AsyncClient) -> None:
        """Wrong password fails, correct password succeeds."""
        secret = "e2e-secret"
        with patch("app.config.settings.app_password", secret):
            # Wrong password
            bad_resp = await client.post("/api/auth/app-login", json={"password": "wrong"})
            assert bad_resp.status_code == 401
            assert COOKIE_NAME not in bad_resp.cookies

            # Still blocked
            set_runtime_credentials(url="https://u", username="admin", password="pass")
            blocked_resp = await client.get("/api/auth/status")
            assert blocked_resp.status_code == 401

            # Correct password
            good_resp = await client.post("/api/auth/app-login", json={"password": secret})
            assert good_resp.status_code == 200
            cookie = good_resp.cookies.get(COOKIE_NAME)

            # Now accessible
            client.cookies.set(COOKIE_NAME, cookie)
            ok_resp = await client.get("/api/auth/status")
            assert ok_resp.status_code == 200

    @pytest.mark.anyio
    async def test_health_always_accessible(self, client: AsyncClient) -> None:
        """Health endpoint works regardless of auth state."""
        with patch("app.config.settings.app_password", "secret"):
            # No cookie
            resp = await client.get("/api/health")
            assert resp.status_code == 200
            assert resp.json() == {"status": "ok"}

    @pytest.mark.anyio
    async def test_no_auth_mode_allows_everything(self, client: AsyncClient) -> None:
        """When APP_PASSWORD is empty, all endpoints work without cookies."""
        with patch("app.config.settings.app_password", ""):
            set_runtime_credentials(url="https://u", username="admin", password="pass")
            resp = await client.get("/api/auth/status")
            assert resp.status_code == 200
            assert resp.json()["configured"] is True


class TestIsEnabled:
    def test_truthy_values(self) -> None:
        assert _is_enabled("true") is True
        assert _is_enabled("1") is True
        assert _is_enabled("yes") is True
        assert _is_enabled("on") is True

    def test_falsy_values(self) -> None:
        assert _is_enabled("false") is False
        assert _is_enabled(None) is False


class TestAccessLogMiddleware:
    """Tests for AccessLogMiddleware using an isolated test app."""

    @staticmethod
    def _build_app() -> FastAPI:
        from app.middleware import AccessLogMiddleware

        test_app = FastAPI()

        @test_app.get("/api/health")
        async def health() -> dict[str, str]:
            return {"status": "ok"}

        @test_app.get("/api/zones")
        async def zones() -> list[str]:
            return []

        test_app.add_middleware(AccessLogMiddleware)
        return test_app

    @pytest.mark.anyio
    async def test_logs_request(self) -> None:
        test_app = self._build_app()
        transport = ASGITransport(app=test_app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            with (
                patch("app.middleware._is_enabled", return_value=False),
                patch("app.middleware.access_log") as mock_log,
            ):
                resp = await ac.get("/api/health")

        assert resp.status_code == 200
        mock_log.info.assert_called_once()
        call_kwargs = mock_log.info.call_args
        assert call_kwargs[0][0] == "request_complete"
        assert call_kwargs[1]["method"] == "GET"
        assert call_kwargs[1]["path"] == "/api/health"
        assert call_kwargs[1]["status"] == 200
        assert "duration_ms" in call_kwargs[1]
        assert call_kwargs[1]["client"] == "127.0.0.1"

    @pytest.mark.anyio
    async def test_suppresses_healthcheck_when_enabled(self) -> None:
        test_app = self._build_app()
        transport = ASGITransport(app=test_app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            with (
                patch("app.middleware._is_enabled", return_value=True),
                patch("app.middleware.access_log") as mock_log,
            ):
                resp = await ac.get("/api/health")

        assert resp.status_code == 200
        mock_log.info.assert_not_called()

    @pytest.mark.anyio
    async def test_does_not_suppress_non_health_when_enabled(self) -> None:
        test_app = self._build_app()
        transport = ASGITransport(app=test_app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            with (
                patch("app.middleware._is_enabled", return_value=True),
                patch("app.middleware.access_log") as mock_log,
            ):
                resp = await ac.get("/api/zones")

        assert resp.status_code == 200
        mock_log.info.assert_called_once()
        assert mock_log.info.call_args[1]["path"] == "/api/zones"
