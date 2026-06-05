"""Application configuration loaded from environment variables / .env.

A single flat `Settings` model keeps the env-var surface area easy to scan
(see `.env.example` for the contract). The app obtains settings via FastAPI's
dependency injection (`Depends(get_settings)`) so tests can override cleanly.
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration. Loaded from process env or a local .env file."""

    # ---- App ----
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    log_level: str = "INFO"
    log_dir: str = "logs"

    # ---- Finnhub ----
    finnhub_api_key: str
    finnhub_base_url: str = "https://finnhub.io/api/v1"
    # NoDecode: keep pydantic-settings from JSON-parsing the env value so our
    # `mode="before"` validator can accept either JSON or comma-separated forms.
    finnhub_tickers: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["AAPL", "MSFT", "GOOG", "AMZN", "NVDA", "TSLA"]
    )
    # Default of 10s keeps 6 tickers at ~36 req/min, well within Finnhub's
    # 60 req/min free-tier limit. Bump this if you have fewer tickers.
    finnhub_poll_interval_seconds: float = 10.0
    finnhub_request_timeout_seconds: float = 10.0
    finnhub_max_retries: int = 3

    # ---- Kafka (Aiven) ----
    kafka_bootstrap_servers: str
    kafka_security_protocol: str = "SASL_SSL"
    kafka_sasl_mechanism: str = "PLAIN"
    kafka_sasl_username: str
    kafka_sasl_password: str
    kafka_topic: str = "stonks.raw.quotes"
    kafka_client_id: str = "stonks-in-motion"
    kafka_transport: str = "native"  # "native" | "rest"
    kafka_rest_base_url: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("finnhub_tickers", mode="before")
    @classmethod
    def _parse_tickers(cls, value: object) -> object:
        """Accept either a JSON list (`["AAPL","MSFT"]`) or a comma-separated string."""
        if isinstance(value, str):
            s = value.strip()
            if s.startswith("["):
                return json.loads(s)
            return [t.strip() for t in s.split(",") if t.strip()]
        return value

    @field_validator("kafka_transport")
    @classmethod
    def _check_transport(cls, value: str) -> str:
        allowed = {"native", "rest"}
        v = value.lower()
        if v not in allowed:
            raise ValueError(f"kafka_transport must be one of {allowed}, got {value!r}")
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton used by the FastAPI lifespan and as a DI dependency."""
    return Settings()
