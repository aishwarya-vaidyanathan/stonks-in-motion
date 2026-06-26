"""Tests for the ReferenceService TTL cache and per-symbol fan-out."""

from __future__ import annotations

from app.config import Settings
from app.reference import ReferenceService


def _service() -> ReferenceService:
    settings = Settings(finnhub_tickers=["AAPL", "MSFT"])
    return ReferenceService(settings)


async def test_cache_fresh_entry_not_refetched():
    svc = _service()
    calls = 0

    async def factory():
        nonlocal calls
        calls += 1
        return calls

    first = await svc._get_or_fetch("k", ttl=3600, factory=factory)
    second = await svc._get_or_fetch("k", ttl=3600, factory=factory)

    assert first == 1
    assert second == 1  # served from cache
    assert calls == 1


async def test_cache_stale_entry_refetched():
    svc = _service()
    calls = 0

    async def factory():
        nonlocal calls
        calls += 1
        return calls

    # ttl=0 expires immediately, so the second call must refetch.
    await svc._get_or_fetch("k", ttl=0, factory=factory)
    second = await svc._get_or_fetch("k", ttl=0, factory=factory)

    assert second == 2
    assert calls == 2


async def test_per_symbol_skips_failures():
    svc = _service()

    async def fetch(symbol: str):
        if symbol == "MSFT":
            raise RuntimeError("boom")
        return {"ok": symbol}

    out = await svc._per_symbol(fetch)

    assert out == {"AAPL": {"ok": "AAPL"}}  # MSFT dropped, not raised


async def test_market_status_failure_is_swallowed(monkeypatch):
    svc = _service()

    async def boom(*_args, **_kwargs):
        from app.producer.finnhub_client import FinnhubError

        raise FinnhubError("down")

    monkeypatch.setattr(svc._client, "fetch_market_status", boom)

    out = await svc.market_status()

    assert out == {"isOpen": None, "session": None}
