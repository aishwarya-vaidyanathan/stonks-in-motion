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
    assert s.kafka_security_protocol == "SSL"


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


def test_settings_kafka_ssl_ca_location_defaults_to_none():
    s = Settings()
    assert s.kafka_ssl_ca_location is None


def test_settings_kafka_ssl_ca_location_loads_from_env(monkeypatch):
    monkeypatch.setenv("KAFKA_SSL_CA_LOCATION", "/opt/secrets/ca.pem")
    s = Settings()
    assert s.kafka_ssl_ca_location == "/opt/secrets/ca.pem"


def test_settings_mtls_paths_default_to_none():
    s = Settings()
    assert s.kafka_ssl_certificate_location is None
    assert s.kafka_ssl_key_location is None


def test_settings_mtls_paths_load_from_env(monkeypatch):
    monkeypatch.setenv("KAFKA_SSL_CERTIFICATE_LOCATION", "/opt/secrets/client.crt")
    monkeypatch.setenv("KAFKA_SSL_KEY_LOCATION", "/opt/secrets/client.key")
    s = Settings()
    assert s.kafka_ssl_certificate_location == "/opt/secrets/client.crt"
    assert s.kafka_ssl_key_location == "/opt/secrets/client.key"


def test_settings_security_protocol_defaults_to_ssl():
    s = Settings()
    assert s.kafka_security_protocol == "SSL"


def test_settings_security_protocol_normalises_to_upper(monkeypatch):
    monkeypatch.setenv("KAFKA_SECURITY_PROTOCOL", "sasl_ssl")
    monkeypatch.setenv("KAFKA_SASL_USERNAME", "u")
    monkeypatch.setenv("KAFKA_SASL_PASSWORD", "p")
    s = Settings()
    assert s.kafka_security_protocol == "SASL_SSL"


def test_settings_rejects_unknown_security_protocol(monkeypatch):
    monkeypatch.setenv("KAFKA_SECURITY_PROTOCOL", "KERBEROS_SSL")
    with pytest.raises(ValidationError):
        Settings()


def test_settings_sasl_username_required_when_protocol_is_sasl(monkeypatch):
    monkeypatch.setenv("KAFKA_SECURITY_PROTOCOL", "SASL_SSL")
    monkeypatch.delenv("KAFKA_SASL_USERNAME", raising=False)
    monkeypatch.setenv("KAFKA_SASL_PASSWORD", "p")
    with pytest.raises(ValidationError):
        Settings()


def test_settings_sasl_password_required_when_protocol_is_sasl(monkeypatch):
    monkeypatch.setenv("KAFKA_SECURITY_PROTOCOL", "SASL_SSL")
    monkeypatch.setenv("KAFKA_SASL_USERNAME", "u")
    monkeypatch.delenv("KAFKA_SASL_PASSWORD", raising=False)
    with pytest.raises(ValidationError):
        Settings()


def test_settings_sasl_optional_when_protocol_is_ssl():
    """mTLS-only path: SASL username/password can be None."""
    s = Settings()  # default protocol = SSL
    assert s.kafka_security_protocol == "SSL"
    assert s.kafka_sasl_username is None
    assert s.kafka_sasl_password is None
