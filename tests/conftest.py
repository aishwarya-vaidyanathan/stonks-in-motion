"""Test configuration: ensure required env vars are set before app import
and that the cached settings singleton is reset between tests."""

from __future__ import annotations

import os

# Set minimum required env vars before any `app.*` import. The autouse fixture
# below clears the cached Settings so per-test overrides take effect.
# Default is SSL (mTLS), matching the app's new default. Tests that exercise
# SASL_SSL override the security protocol + add username/password explicitly.
os.environ.setdefault("FINNHUB_API_KEY", "test-key")
os.environ.setdefault("KAFKA_BOOTSTRAP_SERVERS", "test-broker:1234")
os.environ.setdefault("KAFKA_SECURITY_PROTOCOL", "SSL")

import pytest


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    """Clear the lru_cache on get_settings before and after each test."""
    from app.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
