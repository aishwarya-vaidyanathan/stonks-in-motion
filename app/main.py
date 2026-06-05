"""FastAPI app: serves the dashboard and (in V1d) controls the producer/consumer."""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .config import get_settings
from .logging_config import get_logger, setup_logging

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging(level=settings.log_level, component="web")
    log.info(
        "app.startup",
        host=settings.app_host,
        port=settings.app_port,
        tickers=settings.finnhub_tickers,
        topic=settings.kafka_topic,
    )
    yield
    log.info("app.shutdown")


app = FastAPI(
    title="stonks-in-motion",
    version="0.1.0",
    description="Streaming stock ticker pipeline: Finnhub -> Aiven Kafka.",
    lifespan=lifespan,
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/healthz", tags=["meta"])
def healthz() -> dict[str, bool]:
    """Liveness probe; returns 200 as long as the process is responsive."""
    return {"ok": True}


@app.get("/", response_class=HTMLResponse, tags=["ui"])
def index(request: Request) -> HTMLResponse:
    """Dashboard with Start / Stop controls (wired in V1d)."""
    return templates.TemplateResponse(
        request,
        "index.html",
        {"app_name": "stonks-in-motion"},
    )
