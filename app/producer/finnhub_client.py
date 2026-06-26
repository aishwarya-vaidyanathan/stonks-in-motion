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

    async def _get(self, path: str, params: dict[str, Any]) -> Any:
        """GET `{base}{path}` with token, retry/backoff on errors and 429s.

        Returns parsed JSON. Raises FinnhubError after exhausting retries.
        """
        assert self._client is not None, "use as async context manager"

        url = f"{self._base}{path}"
        query = {**params, "token": self._key}

        last_exc: Exception | None = None
        for attempt in range(self._max_retries):
            try:
                resp = await self._client.get(url, params=query)
                if resp.status_code == 429:
                    wait = 2**attempt
                    log.warning(
                        "finnhub.rate_limited",
                        path=path,
                        attempt=attempt,
                        retry_in_seconds=wait,
                    )
                    await asyncio.sleep(wait)
                    continue
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPError as exc:
                last_exc = exc
                wait = 2**attempt
                log.warning(
                    "finnhub.request_failed",
                    path=path,
                    attempt=attempt,
                    error=str(exc),
                    retry_in_seconds=wait,
                )
                await asyncio.sleep(wait)

        raise FinnhubError(f"failed GET {path} ({params}): {last_exc}")

    async def fetch_quote(self, symbol: str) -> dict[str, Any]:
        """Fetch a quote and return it in our wire schema.

        Raises FinnhubError if all retries fail.
        """
        return transform_quote(symbol, await self._get("/quote", {"symbol": symbol}))

    async def fetch_profile(self, symbol: str) -> dict[str, Any]:
        """Company profile: name, logo URL, market cap, industry."""
        raw = await self._get("/stock/profile2", {"symbol": symbol})
        return {
            "name": raw.get("name"),
            "logo": raw.get("logo"),
            "marketCap": raw.get("marketCapitalization"),  # millions USD
            "industry": raw.get("finnhubIndustry"),
            "weburl": raw.get("weburl"),
            "exchange": raw.get("exchange"),
        }

    async def fetch_metrics(self, symbol: str) -> dict[str, Any]:
        """Key stats from basic financials: 52-week range, P/E, beta."""
        raw = await self._get("/stock/metric", {"symbol": symbol, "metric": "all"})
        m = raw.get("metric") or {}
        return {
            "week52High": m.get("52WeekHigh"),
            "week52Low": m.get("52WeekLow"),
            "pe": m.get("peNormalizedAnnual"),
            "beta": m.get("beta"),
        }

    async def fetch_recommendation(self, symbol: str) -> dict[str, Any]:
        """Latest analyst recommendation buckets (most recent period)."""
        raw = await self._get("/stock/recommendation", {"symbol": symbol})
        latest = raw[0] if isinstance(raw, list) and raw else {}
        return {
            "strongBuy": latest.get("strongBuy", 0),
            "buy": latest.get("buy", 0),
            "hold": latest.get("hold", 0),
            "sell": latest.get("sell", 0),
            "strongSell": latest.get("strongSell", 0),
            "period": latest.get("period"),
        }

    async def fetch_news(self, symbol: str, frm: str, to: str) -> list[dict[str, Any]]:
        """Company news headlines between `frm` and `to` (YYYY-MM-DD)."""
        raw = await self._get(
            "/company-news", {"symbol": symbol, "from": frm, "to": to}
        )
        items = raw if isinstance(raw, list) else []
        return [
            {
                "symbol": symbol,
                "headline": it.get("headline"),
                "source": it.get("source"),
                "url": it.get("url"),
                "datetime": it.get("datetime"),  # unix seconds
                "summary": it.get("summary"),
            }
            for it in items
            if it.get("headline")
        ]

    async def fetch_market_status(self, exchange: str = "US") -> dict[str, Any]:
        """Whether `exchange` is currently open for trading."""
        raw = await self._get("/stock/market-status", {"exchange": exchange})
        return {
            "isOpen": bool(raw.get("isOpen")),
            "session": raw.get("session"),  # pre-market | regular | post-market | null
        }


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
