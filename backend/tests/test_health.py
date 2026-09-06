import asyncio

import httpx

from app.main import app


def request(method: str, path: str, **kwargs) -> httpx.Response:
    async def send() -> httpx.Response:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            return await client.request(method, path, **kwargs)

    return asyncio.run(send())


def test_health_without_database():
    response = request("GET", "/api/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "smart-building-monitoring-api",
    }


def test_local_frontend_cors():
    response = request(
        "OPTIONS",
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    rejected = request("GET", "/api/health", headers={"Origin": "https://example.com"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in rejected.headers
