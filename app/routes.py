"""HTTP API for controlling the producer/consumer and tailing the log file."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from .config import Settings
from .process_manager import ProcessManager

router = APIRouter(prefix="/api", tags=["control"])


def get_manager(request: Request) -> ProcessManager:
    """Resolve the ProcessManager that the lifespan stored on app.state."""
    return request.app.state.process_manager


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


ManagerDep = Annotated[ProcessManager, Depends(get_manager)]


@router.post("/start", summary="Start both producer and consumer")
def start(manager: ManagerDep) -> dict:
    manager.start()
    return manager.state()


@router.post("/stop", summary="Stop both producer and consumer")
def stop(manager: ManagerDep) -> dict:
    manager.stop()
    return manager.state()


@router.get("/status", summary="Current producer/consumer state")
def status(manager: ManagerDep) -> dict:
    return manager.state()


def _tail(path: Path, n: int) -> list[str]:
    """Return the last `n` lines of `path` without reading the whole file."""
    if not path.exists():
        return []
    with path.open("rb") as f:
        try:
            f.seek(0, os.SEEK_END)
            end = f.tell()
        except OSError:
            return []
    if end == 0:
        return []
    block = 4096
    data = bytearray()
    with path.open("rb") as f:
        pos = end
        while pos > 0 and data.count(b"\n") <= n:
            read = min(block, pos)
            pos -= read
            f.seek(pos)
            data = f.read(read) + data
    lines = data.splitlines()[-n:]
    return [ln.decode("utf-8", errors="replace") for ln in lines]


@router.get("/logs", summary="Tail the consumer's JSONL message log")
def logs(
    manager: ManagerDep,
    tail: int = Query(50, ge=1, le=500),
) -> dict:
    log_path = Path(manager.settings.log_dir) / "consumer.jsonl"
    return {
        "log_path": str(log_path),
        "lines": _tail(log_path, tail),
    }
