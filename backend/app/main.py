import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from unifi_topology.adapters.unifi_api import UnifiApiError, UnifiAuthError

from app.config import settings as app_settings
from app.database import DEFAULT_DB_PATH, init_db
from app.logging import configure_logging
from app.middleware import AccessLogMiddleware, AppAuthMiddleware
from app.routers.analyze import router as analyze_router
from app.routers.auth import router as auth_router
from app.routers.rules import router as rules_router
from app.routers.settings import router as settings_router
from app.routers.simulate import router as simulate_router
from app.routers.zone_filter import router as zone_filter_router
from app.routers.zones import router as zones_router

log = structlog.get_logger()
startup_logger = logging.getLogger("uvicorn.error")


def _get_app_access_url() -> str:
    configured_url = os.environ.get("APP_ACCESS_URL")
    if configured_url:
        return configured_url.rstrip("/")

    port = os.environ.get("PORT", "8080")
    return f"http://localhost:{port}"


def _check_plaintext_db_key() -> None:
    """Warn if AI API key is stored in plaintext DB while app auth is enabled."""
    if not app_settings.app_password:
        return
    from app.database import get_session
    from app.models_db import AiConfigRow
    try:
        session = get_session()
        try:
            row = session.get(AiConfigRow, 1)
            if row and row.api_key:
                log.warning("plaintext_db_key", msg="AI API key stored in plaintext database. Use AI_API_KEY env var.")
        finally:
            session.close()
    except Exception:
        pass


def _log_startup_banner() -> None:
    app_url = _get_app_access_url()
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    auth_status = "enabled" if app_settings.app_password else "disabled"
    banner = f"""\
    __  __      _ _______ _
   / / / /___  (_) ____(_) |
  / / / / __ \\/ / /_  / /| |
 / /_/ / / / / / __/ / / | |
 \\____/_/ /_/_/_/   /_/  |_|
  Firewall Analyser

  App:       {app_url}
  Health:    {app_url}/api/health
  Log level: {log_level}
  App auth:  {auth_status}
"""
    for line in banner.splitlines():
        startup_logger.info(line)


def _get_frontend_dist_dir() -> Path:
    configured_dir = os.environ.get("FRONTEND_DIST_DIR")
    if configured_dir:
        return Path(configured_dir)
    return Path(__file__).resolve().parents[2] / "frontend" / "dist"


def _get_frontend_response(frontend_path: str) -> FileResponse | None:
    dist_dir = _get_frontend_dist_dir()
    if not dist_dir.is_dir():
        return None

    resolved_dist_dir = dist_dir.resolve()
    requested_path = frontend_path.strip("/")

    if requested_path:
        candidate = (resolved_dist_dir / requested_path).resolve()
        try:
            candidate.relative_to(resolved_dist_dir)
        except ValueError:
            return None

        if candidate.is_file():
            return FileResponse(candidate)

        if Path(requested_path).suffix:
            return None

    index_path = resolved_dist_dir / "index.html"
    if not index_path.is_file():
        return None

    return FileResponse(index_path)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    init_db(DEFAULT_DB_PATH)
    _log_startup_banner()
    _check_plaintext_db_key()
    yield


configure_logging()

app = FastAPI(title="UniFi Firewall Analyser", lifespan=lifespan)

app.add_middleware(AppAuthMiddleware)
app.add_middleware(AccessLogMiddleware)

# Only add CORS in dev mode (Vite on separate port). In production the frontend
# is served from the same origin so cross-origin requests don't occur.
if not os.environ.get("FRONTEND_DIST_DIR"):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:5174"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.exception_handler(UnifiAuthError)
async def unifi_auth_error_handler(request: Request, exc: UnifiAuthError) -> JSONResponse:
    log.warning("unifi_auth_error", error=str(exc))
    return JSONResponse(status_code=401, content={"detail": str(exc)})


@app.exception_handler(UnifiApiError)
async def unifi_api_error_handler(request: Request, exc: UnifiApiError) -> JSONResponse:
    log.error("unifi_api_error", error=str(exc))
    return JSONResponse(status_code=502, content={"detail": "Failed to communicate with UniFi controller"})

app.include_router(analyze_router)
app.include_router(auth_router)
app.include_router(zones_router)
app.include_router(rules_router)
app.include_router(simulate_router)
app.include_router(settings_router)
app.include_router(zone_filter_router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
async def frontend_root() -> Response:
    response = _get_frontend_response("")
    if response is None:
        raise HTTPException(status_code=404, detail="Not Found")
    return response


@app.get("/{frontend_path:path}", include_in_schema=False)
async def frontend_app(frontend_path: str) -> Response:
    if frontend_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")

    response = _get_frontend_response(frontend_path)
    if response is None:
        raise HTTPException(status_code=404, detail="Not Found")
    return response
