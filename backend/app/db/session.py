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
    """FastAPI dependency: one session per request, closed even when a route fails.

    Read routes never commit. Closing releases the connection and rolls back the
    read transaction. The same cached engine is reused by seeds and tests.
    """
    with Session(get_engine()) as session:
        yield session
