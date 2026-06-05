"""Tests for the consumer module."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from confluent_kafka import KafkaError

from app.config import Settings
from app.consumer import __main__ as consumer_main
from app.consumer.kafka_source import build_record, is_fatal_error

# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------


def _make_settings(**overrides) -> Settings:
    base = {
        "finnhub_api_key": "k",
        "finnhub_base_url": "https://finnhub.io/api/v1",
        "finnhub_tickers": ["AAPL"],
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
        "log_dir": "logs",
    }
    base.update(overrides)
    return Settings(**base)


def _fake_msg(value: dict | str | None, key: str | None = "AAPL", error: KafkaError | None = None):
    msg = MagicMock()
    msg.error.return_value = error
    msg.value.return_value = (
        json.dumps(value).encode()
        if isinstance(value, dict)
        else (value.encode() if isinstance(value, str) else value)
    )
    msg.key.return_value = key.encode() if key else None
    msg.topic.return_value = "stonks.raw.quotes"
    msg.partition.return_value = 0
    msg.offset.return_value = 42
    return msg


# ---------------------------------------------------------------------------
# build_record / is_fatal_error
# ---------------------------------------------------------------------------


def test_build_record_decodes_json_value():
    msg = _fake_msg({"symbol": "AAPL", "current": 1.0})
    rec = build_record(msg)
    assert rec["topic"] == "stonks.raw.quotes"
    assert rec["partition"] == 0
    assert rec["offset"] == 42
    assert rec["key"] == "AAPL"
    assert rec["value"] == {"symbol": "AAPL", "current": 1.0}


def test_build_record_falls_back_to_text_on_bad_json():
    msg = _fake_msg("not-json")
    rec = build_record(msg)
    assert rec["value"] == "not-json"


def test_build_record_handles_null_value():
    msg = _fake_msg(None)
    rec = build_record(msg)
    assert rec["value"] is None


def test_is_fatal_error_returns_bool():
    err = MagicMock(spec=KafkaError)
    err.fatal.return_value = True
    assert is_fatal_error(err) is True

    err.fatal.return_value = False
    assert is_fatal_error(err) is False


# ---------------------------------------------------------------------------
# KafkaSource (mocked Consumer)
# ---------------------------------------------------------------------------


def test_kafka_source_rejects_rest_transport():
    with patch("app.consumer.kafka_source.Consumer"), pytest.raises(NotImplementedError):
        from app.consumer.kafka_source import KafkaSource

        KafkaSource(_make_settings(kafka_transport="rest"))


def test_kafka_source_subscribes_and_polls():
    settings = _make_settings()
    with patch("app.consumer.kafka_source.Consumer") as ConsumerCls:
        from app.consumer.kafka_source import KafkaSource

        src = KafkaSource(settings)
        src.subscribe()
        ConsumerCls.return_value.subscribe.assert_called_once_with(["stonks.raw.quotes"])
        src.poll(0.5)
        ConsumerCls.return_value.poll.assert_called_once_with(0.5)
        src.close()
        ConsumerCls.return_value.close.assert_called_once()


def test_kafka_source_passes_ssl_ca_location_when_set():
    settings = _make_settings(kafka_ssl_ca_location="/etc/ssl/aiven-ca.pem")
    with patch("app.consumer.kafka_source.Consumer") as ConsumerCls:
        from app.consumer.kafka_source import KafkaSource

        KafkaSource(settings)
        cfg = ConsumerCls.call_args[0][0]
    assert cfg["ssl.ca.location"] == "/etc/ssl/aiven-ca.pem"


def test_kafka_source_omits_ssl_ca_location_when_unset():
    settings = _make_settings()
    assert settings.kafka_ssl_ca_location is None
    with patch("app.consumer.kafka_source.Consumer") as ConsumerCls:
        from app.consumer.kafka_source import KafkaSource

        KafkaSource(settings)
        cfg = ConsumerCls.call_args[0][0]
    assert "ssl.ca.location" not in cfg


# ---------------------------------------------------------------------------
# consume_loop (end-to-end with mocked source)
# ---------------------------------------------------------------------------


def _make_source_factory(messages: list, stop: threading.Event):
    """Returns a factory that yields a KafkaSource whose poll() pops from `messages`.

    Once the message list is exhausted, poll returns None and signals `stop` so
    the loop exits.
    """
    msgs = list(messages)
    poll_calls = {"n": 0}

    def factory(settings):
        src = MagicMock()
        src.subscribe = MagicMock()
        src.close = MagicMock()

        def poll(timeout_seconds=1.0):
            poll_calls["n"] += 1
            if not msgs:
                stop.set()
                return None
            return msgs.pop(0)

        src.poll = poll
        src._poll_calls = poll_calls
        return src

    return factory, poll_calls


def test_consume_loop_writes_jsonl_and_exits_on_stop(tmp_path: Path):
    settings = _make_settings(log_dir=str(tmp_path))
    stop = threading.Event()
    msgs = [
        _fake_msg({"symbol": "AAPL", "current": 1.0}),
        _fake_msg({"symbol": "MSFT", "current": 2.0}, key="MSFT"),
    ]
    factory, _ = _make_source_factory(msgs, stop)

    consumer_main.consume_loop(settings, stop, source_factory=factory)

    log_file = tmp_path / "consumer.jsonl"
    assert log_file.exists()
    lines = log_file.read_text().strip().splitlines()
    assert len(lines) == 2
    rec0 = json.loads(lines[0])
    assert rec0["key"] == "AAPL"
    assert rec0["value"] == {"symbol": "AAPL", "current": 1.0}
    rec1 = json.loads(lines[1])
    assert rec1["key"] == "MSFT"


def test_consume_loop_skips_errors_and_continues(tmp_path: Path):
    settings = _make_settings(log_dir=str(tmp_path))
    stop = threading.Event()

    info_msg = _fake_msg({"symbol": "AAPL", "current": 1.0})
    err = MagicMock(spec=KafkaError)
    err.fatal.return_value = False
    err_msg = _fake_msg(None, error=err)
    # The factory will serve [err_msg, info_msg], then None + stop.
    factory, _ = _make_source_factory([err_msg, info_msg], stop)

    consumer_main.consume_loop(settings, stop, source_factory=factory)

    log_file = tmp_path / "consumer.jsonl"
    lines = log_file.read_text().strip().splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0])["key"] == "AAPL"


def test_consume_loop_exits_on_fatal_error(tmp_path: Path):
    settings = _make_settings(log_dir=str(tmp_path))
    stop = threading.Event()
    fatal = MagicMock(spec=KafkaError)
    fatal.fatal.return_value = True
    msg = _fake_msg(None, error=fatal)
    factory, _ = _make_source_factory([msg], stop)

    consumer_main.consume_loop(settings, stop, source_factory=factory)

    log_file = tmp_path / "consumer.jsonl"
    assert not log_file.exists() or log_file.read_text() == ""
