"""Smoke tests: FastAPI boots and core endpoints respond."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_healthz_returns_ok():
    client = TestClient(app)
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_cors_headers_present():
    client = TestClient(app)
    r = client.options(
        "/api/status",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert r.status_code == 200
    assert "access-control-allow-origin" in r.headers


def test_api_status_reachable():
    client = TestClient(app)
    r = client.get("/api/status")
    assert r.status_code == 200
    body = r.json()
    assert "producer" in body
    assert "consumer" in body
