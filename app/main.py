"""FastAPI app: API backend for the streaming pipeline dashboard."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .logging_config import get_logger, setup_logging
from .process_manager import ProcessManager
from .routes import router as control_router

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging(level=settings.log_level, component="web")
    app.state.settings = settings
    app.state.process_manager = ProcessManager(settings)
    log.info(
        "app.startup",
        host=settings.app_host,
        port=settings.app_port,
        tickers=settings.finnhub_tickers,
        topic=settings.kafka_topic,
    )
    try:
        yield
    finally:
        log.info("app.shutdown.cleaning_up")
        app.state.process_manager.stop_all()
        log.info("app.shutdown")


app = FastAPI(
    title="stonks-in-motion",
    version="0.2.0",
    description="Streaming stock ticker pipeline: Finnhub -> Aiven Kafka.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(control_router)


@app.get("/healthz", tags=["meta"])
def healthz() -> dict[str, bool]:
    return {"ok": True}
