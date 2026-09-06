from functools import lru_cache
from collections.abc import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.core.config import settings


@lru_cache
def get_engine() -> Engine:
    if not settings.database_url:
        raise RuntimeError("Set DATABASE_URL in backend/.env before using the database.")
    return create_engine(settings.database_url, pool_pre_ping=True, hide_parameters=True)


def get_session() -> Generator[Session, None, None]:
    """One session per caller; callers explicitly own transaction commits."""
    with Session(get_engine()) as session:
        yield session
