"""Tests for the producer module."""

from __future__ import annotations

import asyncio
import contextlib
import json
from datetime import UTC, datetime
from unittest.mock import patch

import httpx
import pytest

from app.config import Settings
from app.producer.finnhub_client import FinnhubClient, FinnhubError, transform_quote
from app.producer.kafka_sink import KafkaSink

# ---------------------------------------------------------------------------
# transform_quote
# ---------------------------------------------------------------------------


def test_transform_quote_maps_fields():
    raw = {
        "c": 261.74,
        "d": -1.31,
        "dp": -0.4985,
        "h": 264.26,
        "l": 260.68,
        "o": 263.20,
        "pc": 263.05,
        "t": 1763140800,
    }
    out = transform_quote("AAPL", raw)
    assert out["symbol"] == "AAPL"
    assert out["current"] == 261.74
    assert out["open"] == 263.20
    assert out["high"] == 264.26
    assert out["low"] == 260.68
    assert out["prev_close"] == 263.05
    assert out["change"] == -1.31
    assert out["change_pct"] == -0.4985
    assert out["ts"] == datetime.fromtimestamp(1763140800, tz=UTC).isoformat()


def test_transform_quote_handles_missing_ts():
    raw = {"c": 100.0, "o": 99.0, "h": 101.0, "l": 98.0, "pc": 99.5, "d": 0.5, "dp": 0.5}
    out = transform_quote("X", raw)
    assert out["ts"] is None
    assert out["current"] == 100.0


# ---------------------------------------------------------------------------
# FinnhubClient (mocked httpx transport)
# ---------------------------------------------------------------------------


def _make_settings(**overrides):
    base = {
        "finnhub_api_key": "test-key",
        "finnhub_base_url": "https://finnhub.io/api/v1",
        "finnhub_tickers": ["AAPL", "MSFT"],
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
    }
    base.update(overrides)
    return Settings(**base)


def _handler(status: int, body: dict | str = ""):
    def _h(request: httpx.Request) -> httpx.Response:
        return (
            httpx.Response(status, json=body)
            if isinstance(body, dict)
            else httpx.Response(status, text=body)
        )

    return _h


@pytest.mark.asyncio
async def test_finnhub_client_returns_transformed_quote():
    transport = httpx.MockTransport(
        _handler(
            200,
            {
                "c": 1.0,
                "d": 0.1,
                "dp": 10.0,
                "h": 2.0,
                "l": 0.5,
                "o": 0.9,
                "pc": 0.9,
                "t": 1700000000,
            },
        )
    )
    async with FinnhubClient(
        base_url="https://finnhub.io/api/v1",
        api_key="k",
        timeout=5.0,
        max_retries=2,
    ) as client:
        client._client = httpx.AsyncClient(transport=transport, timeout=5.0)  # type: ignore[assignment]
        out = await client.fetch_quote("AAPL")
    assert out["symbol"] == "AAPL"
    assert out["current"] == 1.0


@pytest.mark.asyncio
async def test_finnhub_client_retries_on_429_then_succeeds():
    statuses = iter([429, 429, 200])
    bodies = iter(
        [
            {},
            {},
            {
                "c": 1.0,
                "d": 0.1,
                "dp": 10.0,
                "h": 2.0,
                "l": 0.5,
                "o": 0.9,
                "pc": 0.9,
                "t": 1700000000,
            },
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(next(statuses), json=next(bodies))

    transport = httpx.MockTransport(handler)
    async with FinnhubClient(
        base_url="https://finnhub.io/api/v1",
        api_key="k",
        timeout=5.0,
        max_retries=3,
    ) as client:
        client._client = httpx.AsyncClient(transport=transport, timeout=5.0)  # type: ignore[assignment]
        out = await client.fetch_quote("AAPL")
    assert out["current"] == 1.0


@pytest.mark.asyncio
async def test_finnhub_client_raises_after_exhausting_retries():
    transport = httpx.MockTransport(_handler(500, "boom"))
    async with FinnhubClient(
        base_url="https://finnhub.io/api/v1",
        api_key="k",
        timeout=5.0,
        max_retries=2,
    ) as client:
        client._client = httpx.AsyncClient(transport=transport, timeout=5.0)  # type: ignore[assignment]
        with pytest.raises(FinnhubError):
            await client.fetch_quote("AAPL")


# ---------------------------------------------------------------------------
# KafkaSink (mocked Producer)
# ---------------------------------------------------------------------------


def test_kafka_sink_produce_serializes_and_keys_by_symbol():
    settings = _make_settings()
    with patch("app.producer.kafka_sink.Producer") as ProducerCls:
        sink = KafkaSink(settings)
        ProducerCls.assert_called_once()
        cfg = ProducerCls.call_args[0][0]
        assert cfg["bootstrap.servers"] == "broker:9092"
        assert cfg["security.protocol"] == "SASL_SSL"
        assert cfg["sasl.mechanism"] == "PLAIN"
        assert cfg["acks"] == "all"
        assert cfg["enable.idempotence"] is True

        sink.produce({"symbol": "AAPL", "ts": "t", "current": 1.0})
        sink._producer.produce.assert_called_once()
        kwargs = sink._producer.produce.call_args.kwargs
        assert kwargs["topic"] == "stonks.raw.quotes"
        assert kwargs["key"] == b"AAPL"
        body = json.loads(kwargs["value"].decode())
        assert body["symbol"] == "AAPL"
        assert body["current"] == 1.0


def test_kafka_sink_rejects_rest_transport():
    settings = _make_settings(kafka_transport="rest")
    with patch("app.producer.kafka_sink.Producer"), pytest.raises(NotImplementedError):
        KafkaSink(settings)


# ---------------------------------------------------------------------------
# Producer run loop
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_loop_processes_all_tickers_then_stops(monkeypatch):
    """The main loop should fetch every ticker once, then exit on signal."""
    settings = _make_settings(finnhub_poll_interval_seconds=0.01)

    fetched = []
    produced = []

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        async def fetch_quote(self, symbol):
            fetched.append(symbol)
            return {"symbol": symbol, "ts": "t", "current": 1.0}

    class FakeSink:
        def __init__(self, *a, **kw):
            pass

        def produce(self, p):
            produced.append(p)

        def flush(self, t):
            return 0

    monkeypatch.setattr("app.producer.__main__.FinnhubClient", FakeClient)
    monkeypatch.setattr("app.producer.__main__.KafkaSink", FakeSink)

    from app.producer.__main__ import run

    task = asyncio.create_task(run(settings))
    await asyncio.sleep(0.2)
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task

    # We don't assert exact counts (timing-sensitive), but every ticker should
    # have been hit at least once.
    assert set(fetched) == {"AAPL", "MSFT"}
    assert produced
