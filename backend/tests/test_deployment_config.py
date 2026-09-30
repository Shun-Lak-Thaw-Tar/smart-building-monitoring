"""Deployment configuration checks without a database or real credentials."""
import json
import os
import subprocess
import sys

import pytest
from sqlalchemy.engine import make_url

from app.core.config import Settings


@pytest.mark.parametrize("prefix", ["postgres://", "postgresql://", "postgresql+psycopg://"])
def test_hosted_url_uses_psycopg(prefix):
    url = prefix + "example:placeholder@db.example.invalid:5432/example?sslmode=require"
    config = Settings(_env_file=None, database_url=url, test_database_url=url)
    parsed = make_url(config.database_url)
    assert parsed.drivername == "postgresql+psycopg"
    assert parsed.host == "db.example.invalid"
    assert parsed.query == {"sslmode": "require"}
    assert config.test_database_url == config.database_url


def test_production_cors_and_public_health():
    # Fresh import is important: middleware is configured at process startup.
    env = {**os.environ, "APP_ENV": "production",
           "CORS_ORIGINS": json.dumps(["https://campus.example.invalid"])}
    result = subprocess.run([sys.executable, "-c", '''
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as client:
    assert client.get('/api/health').status_code == 200
    for method in ['GET', 'POST', 'PATCH', 'DELETE']:
        response = client.options('/api/equipment/1', headers={
            'Origin': 'https://campus.example.invalid',
            'Access-Control-Request-Method': method,
            'Access-Control-Request-Headers': 'Authorization,Content-Type'})
        assert response.status_code == 200
        assert response.headers['access-control-allow-origin'] == 'https://campus.example.invalid'
        assert 'access-control-allow-credentials' not in response.headers
    rejected = client.options('/api/health', headers={
        'Origin': 'https://untrusted.example.invalid',
        'Access-Control-Request-Method': 'GET'})
    assert rejected.status_code == 400
    assert 'access-control-allow-origin' not in rejected.headers
    assert client.get('/api/equipment').status_code == 401
print('Production CORS, health and authentication guard passed')
'''], env=env, capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stdout + result.stderr
