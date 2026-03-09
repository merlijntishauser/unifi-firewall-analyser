import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from unifi_topology.adapters.unifi_api import UnifiApiError

from app.routers.auth import router as auth_router
from app.routers.rules import router as rules_router
from app.routers.simulate import router as simulate_router
from app.routers.zones import router as zones_router

logger = logging.getLogger(__name__)

app = FastAPI(title="UniFi Firewall Analyser")

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

app.include_router(auth_router)
app.include_router(zones_router)
app.include_router(rules_router)
app.include_router(simulate_router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
