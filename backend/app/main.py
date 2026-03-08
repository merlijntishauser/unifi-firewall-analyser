from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.auth import router as auth_router
from app.routers.rules import router as rules_router
from app.routers.simulate import router as simulate_router
from app.routers.zones import router as zones_router

app = FastAPI(title="UniFi Firewall Analyser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(zones_router)
app.include_router(rules_router)
app.include_router(simulate_router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
