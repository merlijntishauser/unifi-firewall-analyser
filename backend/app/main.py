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
from app.routers.zones import router as zones_router

logger = logging.getLogger(__name__)


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
    yield


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
