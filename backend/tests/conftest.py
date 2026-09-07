import asyncio

import httpx
import pytest

from app.main import app


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
