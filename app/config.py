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
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
        ]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, value: object) -> object:
        if isinstance(value, str):
            s = value.strip()
            if s.startswith("["):
                return json.loads(s)
            return [o.strip() for o in s.split(",") if o.strip()]
        return value

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
    # "SSL" (mTLS), "SASL_SSL" (username/password), "PLAINTEXT", or "SASL_PLAINTEXT".
    # Default is SSL — Aiven ships every Kafka service with mTLS access certs,
    # and many services are configured mTLS-only (broker sends "certificate
    # required" alerts during the SASL handshake). Use SASL_SSL when the
    # service has username/password auth instead.
    kafka_security_protocol: str = "SSL"
    kafka_sasl_mechanism: str = "PLAIN"
    # SASL is optional; required only when kafka_security_protocol starts
    # with "SASL_". Both fields are ignored for plain SSL/PLAINTEXT.
    kafka_sasl_username: str | None = None
    kafka_sasl_password: str | None = None
    kafka_topic: str = "stonks.raw.quotes"
    kafka_client_id: str = "stonks-in-motion"
    kafka_transport: str = "native"  # "native" | "rest"
    kafka_rest_base_url: str | None = None
    # Optional: pin a specific CA bundle when connecting to Aiven. When unset,
    # librdkafka falls back to the system trust store, which works for Aiven
    # (its broker cert chains to Let's Encrypt, included in `ca-certificates`).
    kafka_ssl_ca_location: str | None = None
    # Optional mTLS client certificate + key. Aiven Kafka ships with mTLS
    # access certs by default; for mTLS-only services these are the only
    # way to authenticate. Both must point to existing files (or both be
    # unset) for mTLS to engage.
    kafka_ssl_certificate_location: str | None = None
    kafka_ssl_key_location: str | None = None

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

    @field_validator("kafka_security_protocol")
    @classmethod
    def _check_security_protocol(cls, value: str) -> str:
        allowed = {"PLAINTEXT", "SSL", "SASL_PLAINTEXT", "SASL_SSL"}
        v = value.upper()
        if v not in allowed:
            raise ValueError(f"kafka_security_protocol must be one of {allowed}, got {value!r}")
        return v

    @field_validator("kafka_sasl_username", "kafka_sasl_password", mode="after")
    @classmethod
    def _require_sasl_when_sasl_protocol(cls, value: str | None, info) -> str | None:
        # Filled in by the model_validate pipeline; we re-read the protocol
        # from info.data to know which sibling field to validate against.
        protocol = (info.data or {}).get("kafka_security_protocol", "")
        if protocol.startswith("SASL_") and not value:
            raise ValueError(
                f"{info.field_name} is required when kafka_security_protocol={protocol!r}"
            )
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton used by the FastAPI lifespan and as a DI dependency."""
    return Settings()
