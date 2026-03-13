"""Application-level middleware.

AppAuthMiddleware: gates API requests behind APP_PASSWORD when configured.
AccessLogMiddleware: emits structured access logs via structlog.
"""

import hashlib
import hmac
import os
import time

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import settings

access_log = structlog.get_logger("app.access")

COOKIE_NAME = "_session"

_EXCLUDED_PATHS = frozenset({
    "/api/auth/app-login",
    "/api/auth/app-status",
    "/api/health",
})


def _sign(timestamp: str, secret: str) -> str:
    return hmac.new(secret.encode(), timestamp.encode(), hashlib.sha256).hexdigest()


def create_session_cookie(secret: str, ttl: int) -> tuple[str, int]:
    """Create a signed session cookie value and max_age."""
    ts = str(int(time.time()))
    sig = _sign(ts, secret)
    return f"{ts}:{sig}", ttl


def verify_session_cookie(cookie_value: str, secret: str, ttl: int) -> bool:
    """Verify a session cookie is valid and not expired."""
    parts = cookie_value.split(":", 1)
    if len(parts) != 2:
        return False

    ts_str, sig = parts
    try:
        ts = int(ts_str)
    except ValueError:
        return False

    if time.time() - ts > ttl:
        return False

    expected = _sign(ts_str, secret)
    return hmac.compare_digest(sig, expected)


def _is_enabled(value: str | None) -> bool:
    return value is not None and value.lower() in {"1", "true", "yes", "on"}


class AccessLogMiddleware(BaseHTTPMiddleware):
    """Emit structured access logs via structlog, replacing uvicorn.access."""

    _suppress_healthcheck: bool

    def __init__(self, app: object) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self._suppress_healthcheck = _is_enabled(os.environ.get("SUPPRESS_HEALTHCHECK_ACCESS_LOGS"))

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if self._suppress_healthcheck and request.url.path == "/api/health":
            return await call_next(request)

        start = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000, 1)

        client_host = request.client.host if request.client else "-"
        access_log.info(
            "request_complete",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
            client=client_host,
        )
        return response


class AppAuthMiddleware(BaseHTTPMiddleware):
    """Gate all API requests behind APP_PASSWORD when configured."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        secret = settings.app_password
        if not secret:
            return await call_next(request)

        path = request.url.path

        # Allow excluded paths and non-API paths (frontend static files)
        if path in _EXCLUDED_PATHS or not path.startswith("/api/"):
            return await call_next(request)

        # Check session cookie
        cookie = request.cookies.get(COOKIE_NAME)
        if not cookie or not verify_session_cookie(cookie, secret, settings.app_session_ttl):
            return JSONResponse(status_code=401, content={"detail": "Authentication required"})

        return await call_next(request)
