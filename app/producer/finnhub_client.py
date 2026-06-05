"""Async Finnhub REST client with simple retry/backoff.

Wraps `httpx.AsyncClient` for the free `/quote` endpoint and translates
Finnhub's terse response into our wire schema. The client is meant to be
used as an async context manager so its connection pool is closed cleanly.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

import httpx

from ..logging_config import get_logger

log = get_logger(__name__)


class FinnhubError(Exception):
    """Raised when a quote fetch fails after exhausting retries."""


class FinnhubClient:
    """Minimal async client for Finnhub's free `/quote` endpoint."""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        timeout: float,
        max_retries: int,
    ) -> None:
        self._base = base_url.rstrip("/")
        self._key = api_key
        self._timeout = timeout
        self._max_retries = max_retries
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> FinnhubClient:
        self._client = httpx.AsyncClient(timeout=self._timeout)
        return self

    async def __aexit__(self, *exc: object) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def fetch_quote(self, symbol: str) -> dict[str, Any]:
        """Fetch a quote and return it in our wire schema.

        Raises FinnhubError if all retries fail.
        """
        assert self._client is not None, "use as async context manager"

        url = f"{self._base}/quote"
        params = {"symbol": symbol, "token": self._key}

        last_exc: Exception | None = None
        for attempt in range(self._max_retries):
            try:
                resp = await self._client.get(url, params=params)
                if resp.status_code == 429:
                    wait = 2**attempt
                    log.warning(
                        "finnhub.rate_limited",
                        symbol=symbol,
                        attempt=attempt,
                        retry_in_seconds=wait,
                    )
                    await asyncio.sleep(wait)
                    continue
                resp.raise_for_status()
                return transform_quote(symbol, resp.json())
            except httpx.HTTPError as exc:
                last_exc = exc
                wait = 2**attempt
                log.warning(
                    "finnhub.request_failed",
                    symbol=symbol,
                    attempt=attempt,
                    error=str(exc),
                    retry_in_seconds=wait,
                )
                await asyncio.sleep(wait)

        raise FinnhubError(f"failed to fetch quote for {symbol}: {last_exc}")


def transform_quote(symbol: str, raw: dict[str, Any]) -> dict[str, Any]:
    """Map Finnhub's `/quote` response to our canonical wire schema.

    Finnhub returns Unix epoch in `t` and abbreviated keys (c/d/dp/h/l/o/pc).
    We rename and convert to ISO-8601 UTC for downstream consumers.
    """
    ts_raw = raw.get("t")
    ts = (
        datetime.fromtimestamp(ts_raw, tz=UTC).isoformat()
        if isinstance(ts_raw, int | float)
        else None
    )
    return {
        "symbol": symbol,
        "ts": ts,
        "current": raw.get("c"),
        "open": raw.get("o"),
        "high": raw.get("h"),
        "low": raw.get("l"),
        "prev_close": raw.get("pc"),
        "change": raw.get("d"),
        "change_pct": raw.get("dp"),
    }
