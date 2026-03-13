"""Database setup using SQLAlchemy and Alembic."""

import os
from pathlib import Path

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models_db import Base

# Keep both spellings for convenience in container environments.
DEFAULT_DB_PATH = Path(
    os.environ.get("ANALYSER_DB_PATH", os.environ.get("ANALYZER_DB_PATH", "data/analyser.db"))
)

_engine: Engine | None = None
_SessionFactory: sessionmaker[Session] | None = None


def _make_url(db_path: Path) -> str:
    return f"sqlite:///{db_path}"


def init_db(db_path: Path = DEFAULT_DB_PATH) -> Engine:
    """Initialize the database engine, run migrations, and return the engine."""
    global _engine, _SessionFactory  # noqa: PLW0603
    db_path.parent.mkdir(parents=True, exist_ok=True)

    _engine = create_engine(_make_url(db_path), echo=False)
    _SessionFactory = sessionmaker(bind=_engine)

    _run_migrations(db_path)
    return _engine


def _run_migrations(db_path: Path) -> None:
    """Run Alembic migrations programmatically."""
    from alembic.config import Config

    from alembic import command

    alembic_cfg = Config()
    alembic_cfg.set_main_option("script_location", str(Path(__file__).parent.parent / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", _make_url(db_path))
    command.upgrade(alembic_cfg, "head")


def get_engine() -> Engine:
    """Get the current engine. Raises if init_db has not been called."""
    if _engine is None:
        msg = "Database not initialized. Call init_db() first."
        raise RuntimeError(msg)
    return _engine


def get_session() -> Session:
    """Create a new session. Caller is responsible for closing it."""
    if _SessionFactory is None:
        msg = "Database not initialized. Call init_db() first."
        raise RuntimeError(msg)
    return _SessionFactory()


def init_db_for_tests(db_path: Path) -> Engine:
    """Initialize a test database with tables created directly (no Alembic)."""
    global _engine, _SessionFactory  # noqa: PLW0603
    db_path.parent.mkdir(parents=True, exist_ok=True)

    _engine = create_engine(_make_url(db_path), echo=False)
    _SessionFactory = sessionmaker(bind=_engine)

    Base.metadata.create_all(_engine)
    return _engine


def reset_engine() -> None:
    """Reset the global engine and session factory. Used in tests."""
    global _engine, _SessionFactory  # noqa: PLW0603
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionFactory = None
