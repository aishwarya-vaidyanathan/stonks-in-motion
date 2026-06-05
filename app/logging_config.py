"""Structured JSON logging via structlog.

Every component (web / producer / consumer) calls `setup_logging(component=...)`
once at startup. The bound `component` context var shows up in every log line,
which makes journald / log shipping / grepping much easier in production.
"""

from __future__ import annotations

import logging
import sys

import structlog

_CONFIGURED = False


def setup_logging(level: str = "INFO", component: str = "web") -> None:
    """Configure stdlib logging + structlog to emit one JSON object per line.

    Idempotent: a second call with the same args is a no-op so child processes
    (producer, consumer) can call it freely after a `subprocess.Popen`.
    """
    global _CONFIGURED
    if _CONFIGURED:
        return

    log_level = getattr(logging, level.upper(), logging.INFO)

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
        force=True,
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(component=component)
    _CONFIGURED = True


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a bound logger; pass `name` for a stable per-module identity."""
    log = structlog.get_logger(name) if name else structlog.get_logger()
    return log
