"""Smoke tests for app.config.Settings."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_loads_with_required_env():
    s = Settings()
    assert s.finnhub_api_key == "test-key"
    assert s.kafka_bootstrap_servers == "test-broker:1234"
    assert "AAPL" in s.finnhub_tickers
    assert s.kafka_transport in ("native", "rest")
    assert s.kafka_security_protocol == "SASL_SSL"


def test_settings_parses_json_ticker_list(monkeypatch):
    monkeypatch.setenv("FINNHUB_TICKERS", '["A","B","C"]')
    s = Settings()
    assert s.finnhub_tickers == ["A", "B", "C"]


def test_settings_parses_csv_ticker_list(monkeypatch):
    monkeypatch.setenv("FINNHUB_TICKERS", "A,B,C")
    s = Settings()
    assert s.finnhub_tickers == ["A", "B", "C"]


def test_settings_strips_ticker_whitespace(monkeypatch):
    monkeypatch.setenv("FINNHUB_TICKERS", " A , B ,C ")
    s = Settings()
    assert s.finnhub_tickers == ["A", "B", "C"]


def test_settings_rejects_unknown_transport(monkeypatch):
    monkeypatch.setenv("KAFKA_TRANSPORT", "carrier-pigeon")
    with pytest.raises(ValidationError):
        Settings()


def test_settings_missing_required_finnhub_key(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    with pytest.raises(ValidationError):
        Settings()


def test_settings_missing_required_kafka_servers(monkeypatch):
    monkeypatch.delenv("KAFKA_BOOTSTRAP_SERVERS", raising=False)
    with pytest.raises(ValidationError):
        Settings()
