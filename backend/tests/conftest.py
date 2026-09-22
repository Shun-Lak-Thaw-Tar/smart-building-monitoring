import asyncio
from pathlib import Path

import httpx
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.seed import seed_baseline
from app.db.session import get_engine
from app.main import app


@pytest.fixture(scope="session")
def isolated_test_database():
    """Prepare a migrated, seeded database without ever touching development data."""
    url = settings.test_database_url
    if not url:
        pytest.fail("Set TEST_DATABASE_URL to an isolated PostgreSQL database ending in _test.")
    parsed = make_url(url)
    if not parsed.drivername.startswith("postgresql") or not (parsed.database or "").lower().endswith("_test"):
        pytest.fail("TEST_DATABASE_URL must target a PostgreSQL database whose name ends in _test.")

    original_url = settings.database_url
    settings.database_url = url
    get_engine.cache_clear()
    engine = get_engine()
    try:
        config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        command.upgrade(config, "head")
        with engine.begin() as connection:
            # Fixed table names plus the _test guard above prevent development-data loss.
            connection.execute(text(
                "TRUNCATE TABLE maintenance_history, request_status_history, maintenance_requests, "
                "environmental_readings, equipment, users, buildings RESTART IDENTITY CASCADE"
            ))
        with Session(engine) as session, session.begin():
            assert seed_baseline(session) == {
                "buildings": 3, "equipment": 9, "environmental_readings": 15,
            }
        yield
    finally:
        engine.dispose()
        get_engine.cache_clear()
        settings.database_url = original_url


@pytest.fixture(autouse=True)
def require_isolated_test_database(request):
    if request.node.get_closest_marker("database"):
        request.getfixturevalue("isolated_test_database")


def pytest_collection_modifyitems(config, items):
    """Fail once, before test setup, when database tests lack their safe target."""
    if "not database" in config.option.markexpr:
        return
    if any(item.get_closest_marker("database") for item in items) and not settings.test_database_url:
        raise pytest.UsageError(
            "Set TEST_DATABASE_URL to an isolated PostgreSQL database ending in _test."
        )


@pytest.fixture
def api_headers():
    return {}


@pytest.fixture
def api_request(api_headers):
    """Exercise ASGI response validation/serialization, including real 500 responses."""
    def request(path, method="GET", **kwargs):
        async def send():
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
                base_url="http://test",
            ) as client:
                headers = kwargs.pop("headers", api_headers)
                return await client.request(method, path, headers=headers, **kwargs)
        return asyncio.run(send())
    return request
