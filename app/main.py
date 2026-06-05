"""FastAPI app: serves the dashboard and supervises the producer/consumer."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .config import get_settings
from .logging_config import get_logger, setup_logging
from .process_manager import ProcessManager
from .routes import router as control_router

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
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
    version="0.1.0",
    description="Streaming stock ticker pipeline: Finnhub -> Aiven Kafka.",
    lifespan=lifespan,
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.include_router(control_router)


@app.get("/healthz", tags=["meta"])
def healthz() -> dict[str, bool]:
    """Liveness probe; returns 200 as long as the process is responsive."""
    return {"ok": True}


@app.get("/", response_class=HTMLResponse, tags=["ui"])
def index(request: Request) -> HTMLResponse:
    """Dashboard with Start / Stop controls and live status + log tail."""
    return templates.TemplateResponse(
        request,
        "index.html",
        {"app_name": "stonks-in-motion"},
    )
