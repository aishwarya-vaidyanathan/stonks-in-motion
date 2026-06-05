"""Consumer entry point: tail Kafka topic, append each message as a JSON line."""

from __future__ import annotations

import json
import signal
import threading
from collections.abc import Callable
from pathlib import Path
from types import FrameType

from ..config import Settings
from ..logging_config import get_logger
from .kafka_source import KafkaSource, build_record, is_fatal_error

log = get_logger(__name__)


def install_signal_handlers(stop: threading.Event) -> None:
    """Wire SIGTERM/SIGINT to set the stop event. Call from the main thread only."""

    def _on_signal(signum: int, _frame: FrameType | None) -> None:
        log.info("consumer.signal_received", signal=signal.Signals(signum).name)
        stop.set()

    signal.signal(signal.SIGTERM, _on_signal)
    signal.signal(signal.SIGINT, _on_signal)


def consume_loop(
    settings: Settings,
    stop: threading.Event,
    *,
    source_factory: Callable[[Settings], KafkaSource] = KafkaSource,
) -> None:
    """Main consumer loop. Returns when `stop` is set.

    `source_factory` is exposed for tests so they can inject a mock KafkaSource.
    """
    log_path = Path(settings.log_dir) / "consumer.jsonl"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    source = source_factory(settings)
    source.subscribe()
    log.info("consumer.started", topic=settings.kafka_topic, log_path=str(log_path))

    with log_path.open("a", encoding="utf-8") as log_file:
        try:
            while not stop.is_set():
                msg = source.poll(timeout_seconds=1.0)
                if msg is None:
                    continue
                err = msg.error()
                if err is not None:
                    if is_fatal_error(err):
                        log.error("kafka.fatal_error", error=str(err))
                        break
                    log.warning("kafka.consume_error", error=str(err))
                    continue
                try:
                    record = build_record(msg)
                except Exception as exc:
                    log.error("kafka.message_parse_failed", error=repr(exc))
                    continue
                log.info("kafka.message_received", **record)
                log_file.write(json.dumps(record, separators=(",", ":")) + "\n")
                log_file.flush()
        finally:
            source.close()
            log.info("consumer.stopped")


def run(settings: Settings) -> None:
    """Production entry point: install signals, then run the loop."""
    stop = threading.Event()
    install_signal_handlers(stop)
    consume_loop(settings, stop)


def main() -> None:
    """Entry point for `python -m app.consumer`."""
    from ..config import Settings
    from ..logging_config import setup_logging

    settings = Settings()
    setup_logging(level=settings.log_level, component="consumer")
    run(settings)


if __name__ == "__main__":
    main()
