import asyncio

import httpx
import pytest

from app.main import app


@pytest.fixture
def api_request():
    """Exercise ASGI response validation/serialization, including real 500 responses."""
    def request(path, method="GET"):
        async def send():
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
                base_url="http://test",
            ) as client:
                return await client.request(method, path)
        return asyncio.run(send())
    return request
