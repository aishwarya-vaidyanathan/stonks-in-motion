"""End-to-end tests for the FastAPI control API."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.process_manager import ComponentState
from app.routes import get_manager


def _fake_state(running: bool = False, pid: int | None = None) -> ComponentState:
    return ComponentState(
        running=running,
        pid=pid,
        started_at="2026-06-04T20:00:00+00:00" if running else None,
        uptime_seconds=12.5 if running else None,
        log_file="/tmp/logs/consumer.log",
        last_exit_code=None,
    )


def _make_manager(tmp_path: Path) -> MagicMock:
    """Build a mock ProcessManager with both runners in a known state."""
    manager = MagicMock()
    manager.settings.log_dir = str(tmp_path)
    producer_state = _fake_state(running=True, pid=100)
    consumer_state = _fake_state(running=True, pid=101)
    manager.producer._state.return_value = producer_state
    manager.consumer._state.return_value = consumer_state
    manager.state.return_value = {
        "producer": producer_state.to_dict(),
        "consumer": consumer_state.to_dict(),
    }
    return manager


@pytest.fixture
def client_with_manager(tmp_path: Path):
    manager = _make_manager(tmp_path)
    app.dependency_overrides[get_manager] = lambda: manager
    with TestClient(app) as client:
        yield client, manager
    app.dependency_overrides.clear()


def test_start_calls_manager_and_returns_state(client_with_manager):
    client, manager = client_with_manager
    r = client.post("/api/start")
    assert r.status_code == 200
    manager.start.assert_called_once()
    body = r.json()
    assert body["producer"]["running"] is True
    assert body["consumer"]["running"] is True


def test_stop_calls_manager_and_returns_state(client_with_manager):
    client, manager = client_with_manager
    r = client.post("/api/stop")
    assert r.status_code == 200
    manager.stop.assert_called_once()
    body = r.json()
    assert body["producer"]["running"] is True  # mocked state says so


def test_status_returns_current_state_without_mutation(client_with_manager):
    client, manager = client_with_manager
    r = client.get("/api/status")
    assert r.status_code == 200
    manager.start.assert_not_called()
    manager.stop.assert_not_called()


def test_logs_returns_empty_when_file_missing(client_with_manager):
    client, _ = client_with_manager
    r = client.get("/api/logs?tail=10")
    assert r.status_code == 200
    body = r.json()
    assert body["lines"] == []
    assert body["log_path"].endswith("consumer.jsonl")


def test_logs_tails_existing_file(client_with_manager, tmp_path: Path):
    client, _ = client_with_manager
    log_file = tmp_path / "consumer.jsonl"
    log_file.write_text("\n".join(json.dumps({"i": i}) for i in range(100)) + "\n")
    r = client.get("/api/logs?tail=5")
    assert r.status_code == 200
    body = r.json()
    assert len(body["lines"]) == 5
    assert json.loads(body["lines"][-1])["i"] == 99


def test_logs_rejects_out_of_range_tail(client_with_manager):
    client, _ = client_with_manager
    r = client.get("/api/logs?tail=10000")
    assert r.status_code == 422


def test_dashboard_includes_required_elements():
    """The HTML must still carry the elements app.js looks for."""
    with TestClient(app) as client:
        r = client.get("/")
        assert r.status_code == 200
        for el in ["start", "stop", "producer-state", "consumer-state", "uptime", "log"]:
            assert f'id="{el}"' in r.text
