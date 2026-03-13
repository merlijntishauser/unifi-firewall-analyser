import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from unifi_topology.adapters.unifi_api import UnifiApiError

from app.database import DEFAULT_DB_PATH, init_db
from app.routers.analyze import router as analyze_router
from app.routers.auth import router as auth_router
from app.routers.rules import router as rules_router
from app.routers.settings import router as settings_router
from app.routers.simulate import router as simulate_router
from app.routers.zone_filter import router as zone_filter_router
from app.routers.zones import router as zones_router

logger = logging.getLogger(__name__)
startup_logger = logging.getLogger("uvicorn.error")


def _is_enabled(value: str | None) -> bool:
    return value is not None and value.lower() in {"1", "true", "yes", "on"}


def _is_healthcheck_access_log(record: logging.LogRecord) -> bool:
    args = record.args
    if isinstance(args, tuple) and len(args) >= 3 and isinstance(args[2], str):
        return args[2].startswith("/api/health")

    return "/api/health" in record.getMessage()


class HealthcheckAccessFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return not _is_healthcheck_access_log(record)


def _configure_access_log_filters() -> None:
    if not _is_enabled(os.environ.get("SUPPRESS_HEALTHCHECK_ACCESS_LOGS")):
        return

    access_logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(existing_filter, HealthcheckAccessFilter) for existing_filter in access_logger.filters):
        access_logger.addFilter(HealthcheckAccessFilter())


def _get_app_access_url() -> str:
    configured_url = os.environ.get("APP_ACCESS_URL")
    if configured_url:
        return configured_url.rstrip("/")

    port = os.environ.get("PORT", "8080")
    return f"http://localhost:{port}"


def _log_startup_banner() -> None:
    if not _is_enabled(os.environ.get("SHOW_STARTUP_BANNER")):
        return

    app_url = _get_app_access_url()
    banner_lines = [
        "============================================================",
        "UniFi Firewall Analyser",
        f"App URL:    {app_url}",
        f"Health URL: {app_url}/api/health",
        "============================================================",
    ]
    for line in banner_lines:
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
    yield


_configure_access_log_filters()

_log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, _log_level, logging.INFO))
logging.getLogger("app").setLevel(getattr(logging, _log_level, logging.INFO))

app = FastAPI(title="UniFi Firewall Analyser", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(UnifiApiError)
async def unifi_api_error_handler(request: Request, exc: UnifiApiError) -> JSONResponse:
    logger.error("UniFi API error: %s", exc)
    return JSONResponse(status_code=502, content={"detail": str(exc)})

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
