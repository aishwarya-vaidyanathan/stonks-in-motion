"""Test configuration: ensure required env vars are set before app import
and that the cached settings singleton is reset between tests."""
from __future__ import annotations

import os

# Set minimum required env vars before any `app.*` import. The autouse fixture
# below clears the cached Settings so per-test overrides take effect.
os.environ.setdefault("FINNHUB_API_KEY", "test-key")
os.environ.setdefault("KAFKA_BOOTSTRAP_SERVERS", "test-broker:1234")
os.environ.setdefault("KAFKA_SASL_USERNAME", "user")
os.environ.setdefault("KAFKA_SASL_PASSWORD", "pass")

import pytest


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    """Clear the lru_cache on get_settings before and after each test."""
    from app.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
