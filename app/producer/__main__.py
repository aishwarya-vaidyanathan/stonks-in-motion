"""Producer entry point: poll Finnhub, push to Kafka, shut down cleanly on SIGTERM."""

from __future__ import annotations

import asyncio
import contextlib
import signal
import time

from ..config import Settings
from ..logging_config import get_logger
from .finnhub_client import FinnhubClient, FinnhubError
from .kafka_sink import KafkaSink

log = get_logger(__name__)


async def run(settings: Settings) -> None:
    """Long-running loop: fetch quotes for each ticker, produce, sleep, repeat."""
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)

    sink = KafkaSink(settings)
    log.info(
        "producer.started",
        tickers=settings.finnhub_tickers,
        topic=settings.kafka_topic,
        poll_interval=settings.finnhub_poll_interval_seconds,
    )

    async with FinnhubClient(
        base_url=settings.finnhub_base_url,
        api_key=settings.finnhub_api_key,
        timeout=settings.finnhub_request_timeout_seconds,
        max_retries=settings.finnhub_max_retries,
    ) as client:
        while not stop.is_set():
            round_started = time.monotonic()
            for symbol in settings.finnhub_tickers:
                if stop.is_set():
                    break
                try:
                    payload = await client.fetch_quote(symbol)
                except FinnhubError as exc:
                    log.error("producer.fetch_failed", symbol=symbol, error=str(exc))
                    continue
                except Exception as exc:
                    log.error(
                        "producer.fetch_unexpected_error",
                        symbol=symbol,
                        error=repr(exc),
                    )
                    continue
                try:
                    sink.produce(payload)
                    log.info("quote.fetched", **payload)
                except BufferError:
                    # Local queue full; serve callbacks then retry once.
                    sink.flush(5)
                    sink.produce(payload)

            elapsed = time.monotonic() - round_started
            remaining = max(0.0, settings.finnhub_poll_interval_seconds - elapsed)
            with contextlib.suppress(asyncio.TimeoutError):
                await asyncio.wait_for(stop.wait(), timeout=remaining)

    remaining_in_flight = sink.flush(10.0)
    log.info("producer.stopped", remaining_in_flight=remaining_in_flight)


def main() -> None:
    """Entry point for `python -m app.producer`."""
    from ..config import Settings, materialize_inline_certs
    from ..logging_config import setup_logging

    settings = materialize_inline_certs(Settings())
    setup_logging(level=settings.log_level, component="producer")
    asyncio.run(run(settings))


if __name__ == "__main__":
    main()
