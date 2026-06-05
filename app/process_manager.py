"""Process manager: spawns and supervises the producer/consumer child processes.

The FastAPI app keeps a single `ProcessManager` instance in `app.state`. The
producer and consumer run as their own subprocesses (`python -m app.producer`,
`python -m app.consumer`) so a hung Kafka client or a leaked httpx connection
can't take the web UI down with it.

Single-host only: state is held in memory, so run with one uvicorn worker
(which is what the systemd unit in V1e does).
"""

from __future__ import annotations

import contextlib
import datetime as dt
import json
import os
import signal
import subprocess
import sys
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from .config import Settings
from .logging_config import get_logger

log = get_logger(__name__)

GRACEFUL_SHUTDOWN_SECONDS = 5.0
HARD_KILL_SECONDS = 5.0


@dataclass
class ComponentState:
    """Snapshot of a runner's state, returned by the API."""

    running: bool
    pid: int | None
    started_at: str | None
    uptime_seconds: float | None
    log_file: str
    last_exit_code: int | None = None

    def to_dict(self) -> dict:
        return asdict(self)


class _Runner:
    """One supervised subprocess. Thread-safe start/stop/state."""

    def __init__(
        self,
        *,
        name: str,
        module: str,
        settings: Settings,
        log_path: Path,
        popen_factory: type[subprocess.Popen] = subprocess.Popen,
    ) -> None:
        self.name = name
        self.module = module
        self.settings = settings
        self.log_path = log_path
        self._popen_factory = popen_factory

        self._proc: subprocess.Popen | None = None
        self._started_at_wall: dt.datetime | None = None
        self._started_at_mono: float | None = None
        self._last_exit_code: int | None = None
        self._log_handle: object | None = None
        self._lock = threading.Lock()

    def _build_args(self) -> list[str]:
        return [sys.executable, "-m", self.module]

    def _build_env(self) -> dict[str, str]:
        """Project every Settings field into the child's env so it can re-load.

        pydantic-settings reads from `os.environ` (or a .env next to CWD), so
        we forward both the inherited environment and the canonical values
        derived from the live Settings object.
        """
        env = os.environ.copy()
        for field_name, value in self.settings.model_dump().items():
            if value is None:
                continue
            env_var = field_name.upper()
            if isinstance(value, list):
                env[env_var] = json.dumps(value)
            elif isinstance(value, bool):
                env[env_var] = "true" if value else "false"
            else:
                env[env_var] = str(value)
        return env

    def is_running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def start(self) -> ComponentState:
        with self._lock:
            if self.is_running():
                return self._state()
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
            # The file handle outlives this call (we read it back on stop()),
            # so we open it explicitly and close it in stop() / on Popen error.
            self._log_handle = open(self.log_path, "ab", buffering=0)  # noqa: SIM115
            try:
                self._proc = self._popen_factory(
                    self._build_args(),
                    env=self._build_env(),
                    cwd=str(Path.cwd()),
                    stdout=self._log_handle,  # type: ignore[arg-type]
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )
            except Exception:
                if self._log_handle is not None:
                    self._log_handle.close()  # type: ignore[attr-defined]
                    self._log_handle = None
                raise
            self._started_at_wall = dt.datetime.now(dt.UTC)
            self._started_at_mono = time.monotonic()
            log.info(
                "runner.started",
                name=self.name,
                pid=self._proc.pid,
                log_file=str(self.log_path),
            )
            return self._state()

    def stop(self) -> ComponentState:
        with self._lock:
            if not self.is_running():
                return self._state()
            assert self._proc is not None
            pid = self._proc.pid
            with contextlib.suppress(ProcessLookupError):
                os.killpg(os.getpgid(pid), signal.SIGTERM)
            try:
                self._proc.wait(timeout=GRACEFUL_SHUTDOWN_SECONDS)
            except subprocess.TimeoutExpired:
                log.warning("runner.term_timeout", name=self.name, pid=pid)
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(os.getpgid(pid), signal.SIGKILL)
                try:
                    self._proc.wait(timeout=HARD_KILL_SECONDS)
                except subprocess.TimeoutExpired:
                    log.error("runner.kill_timeout", name=self.name, pid=pid)
            self._last_exit_code = self._proc.returncode
            self._proc = None
            self._started_at_wall = None
            self._started_at_mono = None
            if self._log_handle is not None:
                self._log_handle.close()  # type: ignore[attr-defined]
                self._log_handle = None
            log.info("runner.stopped", name=self.name, pid=pid)
            return self._state()

    def _state(self) -> ComponentState:
        if not self.is_running():
            last_exit = self._last_exit_code
            if last_exit is None and self._proc is not None:
                last_exit = self._proc.returncode
            return ComponentState(
                running=False,
                pid=None,
                started_at=None,
                uptime_seconds=None,
                log_file=str(self.log_path),
                last_exit_code=last_exit,
            )
        assert self._proc is not None
        uptime = time.monotonic() - (self._started_at_mono or time.monotonic())
        return ComponentState(
            running=True,
            pid=self._proc.pid,
            started_at=self._started_at_wall.isoformat() if self._started_at_wall else None,
            uptime_seconds=uptime,
            log_file=str(self.log_path),
        )


class ProcessManager:
    """Owns one ProducerRunner + one ConsumerRunner. Exposed via FastAPI state."""

    def __init__(self, settings: Settings) -> None:
        log_dir = Path(settings.log_dir)
        self.settings = settings
        self.producer = _Runner(
            name="producer",
            module="app.producer",
            settings=settings,
            log_path=log_dir / "producer.log",
        )
        self.consumer = _Runner(
            name="consumer",
            module="app.consumer",
            settings=settings,
            log_path=log_dir / "consumer.log",
        )

    def start(self) -> None:
        self.producer.start()
        self.consumer.start()

    def stop(self) -> None:
        self.producer.stop()
        self.consumer.stop()

    def stop_all(self) -> None:
        self.producer.stop()
        self.consumer.stop()

    def state(self) -> dict:
        return {
            "producer": self.producer._state().to_dict(),
            "consumer": self.consumer._state().to_dict(),
        }
