"""Tests for app startup (lifespan)."""

from unittest.mock import patch

import pytest
from fastapi import FastAPI

from app.main import lifespan


@pytest.mark.anyio
async def test_lifespan_calls_init_db() -> None:
    test_app = FastAPI()
    with patch("app.main.init_db") as mock_init:
        async with lifespan(test_app):
            mock_init.assert_called_once()
