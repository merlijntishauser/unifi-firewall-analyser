from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import (
    clear_runtime_credentials,
    get_credential_source,
    get_unifi_config,
    set_runtime_credentials,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    url: str
    username: str
    password: str
    site: str = "default"
    verify_ssl: bool = False


class LoginResponse(BaseModel):
    status: str
    message: str


class LogoutResponse(BaseModel):
    status: str
    message: str


class AuthStatusResponse(BaseModel):
    configured: bool
    source: Literal["env", "runtime", "none"]
    url: str
    username: str


@router.post("/login")
async def login(request: LoginRequest) -> LoginResponse:
    set_runtime_credentials(
        url=request.url,
        username=request.username,
        password=request.password,
        site=request.site,
        verify_ssl=request.verify_ssl,
    )
    return LoginResponse(status="ok", message="Credentials stored")


@router.post("/logout")
async def logout() -> LogoutResponse:
    clear_runtime_credentials()
    return LogoutResponse(status="ok", message="Credentials cleared")


@router.get("/status")
async def status() -> AuthStatusResponse:
    config = get_unifi_config()
    source = get_credential_source()

    if config is None:
        return AuthStatusResponse(configured=False, source="none", url="", username="")

    return AuthStatusResponse(configured=True, source=source, url=config.url, username=config.username)
