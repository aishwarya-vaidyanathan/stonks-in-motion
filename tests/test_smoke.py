"""End-to-end smoke test: the FastAPI app boots, serves the dashboard,
and the static asset is reachable."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_healthz_returns_ok():
    client = TestClient(app)
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_index_renders_dashboard():
    client = TestClient(app)
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    body = r.text
    assert "stonks-in-motion" in body
    assert "Start Stream" in body
    assert "Stop Stream" in body
    assert 'id="log"' in body  # log tail placeholder


def test_static_app_js_served():
    client = TestClient(app)
    r = client.get("/static/app.js")
    assert r.status_code == 200
    assert "addEventListener" in r.text
