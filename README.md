# stonks-in-motion

> Turning stonks into streams with Finnhub and Kafka for real-time analytics and experimentation.

A production-shaped streaming pipeline with a modern React dashboard:

- **Producer** polls the free [Finnhub](https://finnhub.io/) REST API for stock quotes on a schedule.
- **Aiven Kafka** (free tier) holds the messages on a topic.
- **Consumer** tails that topic and writes a structured JSON log.
- A **FastAPI** backend exposes **Start / Stop** controls, SSE streaming, and a REST API.
- A **React + Tremor** dashboard on GitHub Pages shows real-time price data, charts, and pipeline controls.

## Architecture

```
┌───────────────────┐      HTTPS/JSON       ┌────────────────────┐
│   GitHub Pages    │ ◄──────────────────── │   Render.com       │
│   React + Tremor  │ ────────────────────► │   FastAPI backend   │
│   (static SPA)    │   start/stop/status   │   Producer/Consumer │
└───────────────────┘                       └────────┬───────────┘
                                                     │
                                      ┌──────────────┼──────────────┐
                                      ▼              ▼              ▼
                                ┌──────────┐  ┌───────────┐  ┌──────────┐
                                │ Finnhub  │  │   Aiven   │  │  logs/   │
                                │ REST API │  │   Kafka   │  │  *.jsonl │
                                └──────────┘  └───────────┘  └──────────┘
```

## Status

- [x] V1a — Project scaffold, config, structured logging, FastAPI shell, smoke tests
- [x] V1b — Finnhub REST poller + confluent-kafka producer
- [x] V1c — Kafka consumer writing JSON log file
- [x] V1d — Web Start/Stop controls + status + log tail
- [x] V1e — CI + deploy pipeline
- [x] V2a — Replatform: Render.com backend + GitHub Pages frontend
- [ ] V2b — Enhanced dashboard with charts, KPI cards, dark mode

## Repo layout

```
app/                  # FastAPI backend
  main.py             # Entry point (uvicorn target), CORS middleware
  config.py           # pydantic-settings, reads .env
  logging_config.py   # structlog -> JSON
  routes.py           # REST API + SSE stream endpoint
  process_manager.py  # Supervises producer + consumer subprocesses
  producer/           # python -m app.producer (Finnhub -> Kafka)
  consumer/           # python -m app.consumer (Kafka -> JSONL)
frontend/             # React + Vite + Tremor dashboard
  src/                # Components, hooks, API client
tests/                # pytest (66 tests)
.github/workflows/    # ci.yml + deploy-pages.yml
render.yaml           # Render.com deploy blueprint
```

## Quickstart (local development)

### Backend

```bash
git clone git@github.com:aishwarya-vaidyanathan/stonks-in-motion.git
cd stonks-in-motion

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

cp .env.example .env
# Edit .env: set FINNHUB_API_KEY and KAFKA_* values

uvicorn app.main:app --reload
```

Backend runs at http://127.0.0.1:8000. Health check: http://127.0.0.1:8000/healthz

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard runs at http://localhost:5173 with API proxied to backend.

## Running tests

```bash
# Backend
pytest
ruff check .
ruff format --check .

# Frontend
cd frontend
npm run lint
npm run build
```

## Configuration

All configuration is environment-variable driven. See [`.env.example`](.env.example) for the full list.

| Var | Purpose |
|---|---|
| `FINNHUB_API_KEY` | Free API key from finnhub.io |
| `FINNHUB_TICKERS` | JSON list or CSV of symbols, e.g. `["AAPL","MSFT"]` or `AAPL,MSFT` |
| `FINNHUB_POLL_INTERVAL_SECONDS` | How often to fetch each ticker (default 10s) |
| `KAFKA_BOOTSTRAP_SERVERS` | `host:port` from the Aiven console |
| `KAFKA_SECURITY_PROTOCOL` | `SSL` (mTLS, default) or `SASL_SSL` |
| `KAFKA_TOPIC` | Default `stonks.raw.quotes` |
| `CORS_ORIGINS` | Comma-separated allowed origins for the frontend |

## Deploy

### Backend (Render.com)

1. Connect repo to Render.com
2. Render auto-detects `render.yaml` blueprint
3. Set environment variables in Render dashboard (secrets from `.env.example`)
4. Push to `main` triggers auto-deploy

### Frontend (GitHub Pages)

1. Set `RENDER_API_URL` as a GitHub repository variable (e.g. `https://stonks-in-motion.onrender.com`)
2. Enable GitHub Pages with "GitHub Actions" as the source
3. Push frontend changes to `main` triggers the `deploy-pages.yml` workflow

## Tech stack

**Backend:** Python 3.12, FastAPI, pydantic-settings, httpx, confluent-kafka, structlog
**Frontend:** React 19, Vite, TypeScript, Tremor, Tailwind CSS
**Infra:** Render.com (free tier), GitHub Pages, Aiven Kafka (free tier), Finnhub (free tier)
**CI:** GitHub Actions (pytest, ruff, eslint, vite build)
