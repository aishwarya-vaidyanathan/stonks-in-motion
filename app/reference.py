"""Slow-changing Finnhub reference data (profiles, metrics, recommendations,
news, market status) served straight from the web process with a TTL cache.

This bypasses the Kafka quote pipeline entirely: these endpoints change at most
a few times a day, so the FastAPI server fetches them on demand and memoizes
the result for a configurable TTL. Keeps Finnhub call volume tiny.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from .config import Settings
from .logging_config import get_logger
from .producer.finnhub_client import FinnhubClient

log = get_logger(__name__)

# Cache TTLs (seconds).
TTL_PROFILES = 24 * 3600
TTL_METRICS = 3600
TTL_RECOMMENDATIONS = 12 * 3600
TTL_NEWS = 15 * 60
TTL_MARKET = 60


class ReferenceService:
    """Holds a FinnhubClient and a tiny TTL cache keyed by data kind."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        # Reference data is not latency-critical and must never block the
        # /api/status path on a slow backoff, so fail fast (no retries).
        self._client = FinnhubClient(
            base_url=settings.finnhub_base_url,
            api_key=settings.finnhub_api_key,
            timeout=settings.finnhub_request_timeout_seconds,
            max_retries=1,
        )
        # key -> (expires_at_monotonic, value)
        self._cache: dict[str, tuple[float, Any]] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def open(self) -> None:
        await self._client.__aenter__()

    async def aclose(self) -> None:
        await self._client.__aexit__()

    def _lock(self, key: str) -> asyncio.Lock:
        lock = self._locks.get(key)
        if lock is None:
            lock = asyncio.Lock()
            self._locks[key] = lock
        return lock

    async def _get_or_fetch(
        self, key: str, ttl: float, factory: Callable[[], Awaitable[Any]]
    ) -> Any:
        now = time.monotonic()
        hit = self._cache.get(key)
        if hit is not None and hit[0] > now:
            return hit[1]
        # Single-flight per key so a burst of requests makes one upstream call.
        async with self._lock(key):
            hit = self._cache.get(key)
            if hit is not None and hit[0] > time.monotonic():
                return hit[1]
            value = await factory()
            self._cache[key] = (time.monotonic() + ttl, value)
            return value

    async def _per_symbol(
        self, fetch: Callable[[str], Awaitable[Any]]
    ) -> dict[str, Any]:
        """Run `fetch` for every ticker concurrently; skip ones that error."""
        syms = self._settings.finnhub_tickers
        results = await asyncio.gather(
            *(fetch(s) for s in syms), return_exceptions=True
        )
        out: dict[str, Any] = {}
        for sym, res in zip(syms, results, strict=False):
            if isinstance(res, Exception):
                log.warning("reference.symbol_failed", symbol=sym, error=str(res))
                continue
            out[sym] = res
        return out

    async def profiles(self) -> dict[str, Any]:
        return await self._get_or_fetch(
            "profiles", TTL_PROFILES, lambda: self._per_symbol(self._client.fetch_profile)
        )

    async def metrics(self) -> dict[str, Any]:
        return await self._get_or_fetch(
            "metrics", TTL_METRICS, lambda: self._per_symbol(self._client.fetch_metrics)
        )

    async def recommendations(self) -> dict[str, Any]:
        return await self._get_or_fetch(
            "recommendations",
            TTL_RECOMMENDATIONS,
            lambda: self._per_symbol(self._client.fetch_recommendation),
        )

    async def news(self, limit: int = 30) -> list[dict[str, Any]]:
        async def _fetch_all() -> list[dict[str, Any]]:
            to = datetime.now(UTC).date()
            frm = to - timedelta(days=7)
            per = await self._per_symbol(
                lambda s: self._client.fetch_news(s, frm.isoformat(), to.isoformat())
            )
            merged: list[dict[str, Any]] = []
            for items in per.values():
                merged.extend(items)
            merged.sort(key=lambda it: it.get("datetime") or 0, reverse=True)
            return merged

        # Cache the full merged feed; callers slice to `limit`.
        full = await self._get_or_fetch("news", TTL_NEWS, _fetch_all)
        return full[:limit]

    async def market_status(self) -> dict[str, Any]:
        async def _fetch() -> dict[str, Any]:
            # Cache the fallback too, so an outage costs one call per TTL rather
            # than one per request, and never breaks /api/status.
            try:
                return await self._client.fetch_market_status(
                    self._settings.finnhub_market_exchange
                )
            except Exception as exc:  # status must never 500
                log.warning("reference.market_status_failed", error=repr(exc))
                return {"isOpen": None, "session": None}

        return await self._get_or_fetch("market", TTL_MARKET, _fetch)
