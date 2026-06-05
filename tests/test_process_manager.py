"""Tests for the process manager."""
from __future__ import annotations

import signal
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.config import Settings
from app.process_manager import (
    ProcessManager,
    _Runner,
)

# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------


def _make_settings(**overrides) -> Settings:
    base = {
        "finnhub_api_key": "k",
        "finnhub_base_url": "https://finnhub.io/api/v1",
        "finnhub_tickers": ["AAPL"],
        "finnhub_poll_interval_seconds": 10.0,
        "finnhub_request_timeout_seconds": 5.0,
        "finnhub_max_retries": 3,
        "kafka_bootstrap_servers": "broker:9092",
        "kafka_security_protocol": "SASL_SSL",
        "kafka_sasl_mechanism": "PLAIN",
        "kafka_sasl_username": "u",
        "kafka_sasl_password": "p",
        "kafka_topic": "stonks.raw.quotes",
        "kafka_client_id": "stonks-in-motion",
        "kafka_transport": "native",
        "log_dir": "logs",
    }
    base.update(overrides)
    return Settings(**base)


class _FakeProc:
    """A Popen double that pretends to be a child process."""

    def __init__(self, *args, pid: int = 1234, **kwargs) -> None:
        self.args = args
        self.kwargs = kwargs
        self.pid = pid
        self._returncode: int | None = None
        self._signals: list[int] = []

    @property
    def returncode(self) -> int | None:
        return self._returncode

    def poll(self) -> int | None:
        return self._returncode

    def send_signal(self, sig: int) -> None:
        self._signals.append(sig)
        if sig == signal.SIGTERM:
            self._returncode = 0
        elif sig == signal.SIGKILL:
            self._returncode = -9

    def wait(self, timeout: float | None = None) -> int:
        if self._returncode is None:
            self._returncode = 0
        return self._returncode


def _make_runner(tmp_path: Path, *, popen_factory: type[subprocess.Popen] | None = None) -> _Runner:
    if popen_factory is None:
        popen_factory = MagicMock(side_effect=lambda *a, **kw: _FakeProc(*a, **kw))
    settings = _make_settings(log_dir=str(tmp_path))
    return _Runner(
        name="test",
        module="app.producer",
        settings=settings,
        log_path=tmp_path / "test.log",
        popen_factory=popen_factory,
    )


# ---------------------------------------------------------------------------
# _Runner
# ---------------------------------------------------------------------------


def test_runner_starts_and_reports_running(tmp_path: Path):
    runner = _make_runner(tmp_path)
    state = runner.start()
    assert state.running is True
    assert state.pid == 1234
    assert state.started_at is not None
    assert state.uptime_seconds is not None and state.uptime_seconds >= 0
    assert state.log_file.endswith("test.log")


def test_runner_is_idempotent_on_repeat_start(tmp_path: Path):
    factory = MagicMock(side_effect=lambda *a, **kw: _FakeProc(*a, pid=1, **kw))
    runner = _make_runner(tmp_path, popen_factory=factory)
    runner.start()
    runner.start()
    runner.start()
    assert factory.call_count == 1


def test_runner_stop_sends_sigterm_to_process_group(tmp_path: Path):
    runner = _make_runner(tmp_path)
    runner.start()
    with patch("os.getpgid", return_value=1234), patch("os.killpg") as killpg:
        runner.stop()
    killpg.assert_called_once()
    args, _ = killpg.call_args
    assert args[0] == 1234
    assert args[1] == signal.SIGTERM


def test_runner_stop_is_idempotent(tmp_path: Path):
    runner = _make_runner(tmp_path)
    runner.start()
    with patch("os.getpgid", return_value=1234), patch("os.killpg"):
        runner.stop()
    state = runner.stop()  # second stop should be a no-op
    assert state.running is False


def test_runner_stop_handles_already_dead_child(tmp_path: Path):
    runner = _make_runner(tmp_path)
    runner.start()
    runner._proc._returncode = 0  # child exited
    with patch("os.getpgid", return_value=1234), patch("os.killpg"):
        state = runner.stop()
    assert state.running is False
    assert state.last_exit_code == 0


def test_runner_forwards_settings_to_subprocess_env(tmp_path: Path):
    factory = MagicMock(return_value=_FakeProc())
    runner = _make_runner(tmp_path, popen_factory=factory)
    runner.start()
    env = factory.call_args.kwargs["env"]
    assert env["FINNHUB_API_KEY"] == "k"
    assert env["KAFKA_BOOTSTRAP_SERVERS"] == "broker:9092"
    assert env["KAFKA_SASL_USERNAME"] == "u"
    # List field serialised as JSON.
    import json

    assert json.loads(env["FINNHUB_TICKERS"]) == ["AAPL"]


def test_runner_uses_start_new_session(tmp_path: Path):
    factory = MagicMock(return_value=_FakeProc())
    runner = _make_runner(tmp_path, popen_factory=factory)
    runner.start()
    assert factory.call_args.kwargs["start_new_session"] is True


# ---------------------------------------------------------------------------
# ProcessManager
# ---------------------------------------------------------------------------


def test_process_manager_exposes_both_runners(tmp_path: Path):
    pids = iter([200, 201])
    factory = MagicMock(side_effect=lambda *a, **kw: _FakeProc(*a, pid=next(pids), **kw))
    settings = _make_settings(log_dir=str(tmp_path))
    pm = ProcessManager(settings)
    pm.producer._popen_factory = factory
    pm.consumer._popen_factory = factory
    with patch("os.getpgid", return_value=1234), patch("os.killpg"):
        pm.start()
        state = pm.state()
    assert state["producer"]["running"] is True
    assert state["consumer"]["running"] is True
    with patch("os.getpgid", return_value=1234), patch("os.killpg"):
        pm.stop()
        final = pm.state()
    assert final["producer"]["running"] is False
    assert final["consumer"]["running"] is False
