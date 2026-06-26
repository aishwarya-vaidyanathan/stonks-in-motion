"""HTTP API for controlling the producer/consumer and tailing the log file."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from .config import Settings
from .process_manager import ProcessManager
from .reference import ReferenceService

router = APIRouter(prefix="/api", tags=["control"])


def get_manager(request: Request) -> ProcessManager:
    """Resolve the ProcessManager that the lifespan stored on app.state."""
    return request.app.state.process_manager


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_reference(request: Request) -> ReferenceService:
    """Resolve the ReferenceService that the lifespan stored on app.state."""
    return request.app.state.reference


ManagerDep = Annotated[ProcessManager, Depends(get_manager)]
ReferenceDep = Annotated[ReferenceService, Depends(get_reference)]


@router.post("/start", summary="Start both producer and consumer")
def start(manager: ManagerDep) -> dict:
    manager.start()
    return manager.state()


@router.post("/stop", summary="Stop both producer and consumer")
def stop(manager: ManagerDep) -> dict:
    manager.stop()
    return manager.state()


@router.get("/status", summary="Current producer/consumer state")
async def status(manager: ManagerDep, reference: ReferenceDep) -> dict:
    state = manager.state()
    state["market"] = await reference.market_status()
    return state


@router.get("/profiles", summary="Company profiles (logo, name, market cap)")
async def profiles(reference: ReferenceDep) -> dict:
    return await reference.profiles()


@router.get("/metrics", summary="Key stats (52-week range, P/E, beta)")
async def metrics(reference: ReferenceDep) -> dict:
    return await reference.metrics()


@router.get("/recommendations", summary="Analyst recommendation trends")
async def recommendations(reference: ReferenceDep) -> dict:
    return await reference.recommendations()


@router.get("/news", summary="Recent company news headlines")
async def news(
    reference: ReferenceDep,
    limit: int = Query(30, ge=1, le=100),
) -> list[dict]:
    return await reference.news(limit)


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


@router.get("/logs/{component}", summary="Tail any component log file")
def component_logs(
    component: str,
    manager: ManagerDep,
    tail: int = Query(50, ge=1, le=500),
) -> dict:
    log_dir = Path(manager.settings.log_dir)
    for ext in ("log", "jsonl"):
        path = log_dir / f"{component}.{ext}"
        if path.exists():
            return {"log_path": str(path), "lines": _tail(path, tail)}
    return {"log_path": f"{log_dir}/{component}.*", "lines": []}


@router.get("/quotes/history", summary="Parsed quote history for charts")
def quotes_history(
    manager: ManagerDep,
    tail: int = Query(200, ge=1, le=1000),
) -> list[dict]:
    log_path = Path(manager.settings.log_dir) / "consumer.jsonl"
    raw_lines = _tail(log_path, tail)
    quotes: list[dict] = []
    for line in raw_lines:
        try:
            record = json.loads(line)
            value = record.get("value")
            if isinstance(value, dict) and "symbol" in value:
                quotes.append(value)
        except (json.JSONDecodeError, KeyError):
            continue
    return quotes


async def _sse_generator(manager: ProcessManager, reference: ReferenceService):
    """Yield SSE events: pipeline status + latest quotes every 2 seconds."""
    log_path = Path(manager.settings.log_dir) / "consumer.jsonl"
    last_offset = 0
    while True:
        state = manager.state()
        state["market"] = await reference.market_status()
        yield f"event: status\ndata: {json.dumps(state)}\n\n"

        if log_path.exists():
            size = log_path.stat().st_size
            if size > last_offset:
                new_lines = _tail(log_path, 10)
                for line in new_lines:
                    try:
                        record = json.loads(line)
                        value = record.get("value")
                        if isinstance(value, dict) and "symbol" in value:
                            yield f"event: quote\ndata: {json.dumps(value)}\n\n"
                    except (json.JSONDecodeError, KeyError):
                        continue
                last_offset = size

        await asyncio.sleep(2)


@router.get("/stream", summary="SSE stream of status and quotes")
async def stream(manager: ManagerDep, reference: ReferenceDep) -> StreamingResponse:
    return StreamingResponse(
        _sse_generator(manager, reference),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
