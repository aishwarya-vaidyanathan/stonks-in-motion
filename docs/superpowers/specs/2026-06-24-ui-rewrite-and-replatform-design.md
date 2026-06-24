# Stonks-in-Motion: UI Rewrite & Replatform Design

**Date:** 2026-06-24
**Status:** Draft

## Context

The project is a working Finnhub → Kafka streaming pipeline with a FastAPI backend, built for a data engineering portfolio. The original deployment target (Hetzner VPS) has been decommissioned. The UI (vanilla JS + Jinja2 templates) needs a complete overhaul for portfolio presentation. Goal: free hosting, modern interactive dashboard, keep Kafka in the architecture.

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

### Hosting

| Component | Host | Cost | Notes |
|-----------|------|------|-------|
| Frontend (SPA) | GitHub Pages | Free | Static React build, custom domain optional |
| Backend (API + pipeline) | Render.com free tier | Free | Sleeps after 15min inactivity, ~30s cold start |
| Kafka | Aiven free tier | Free | Existing instance, SSL+mTLS |
| Data source | Finnhub free tier | Free | 60 req/min limit |

### Render.com Free Tier Behavior

- Web service spins down after 15 minutes of no inbound requests
- First request after sleep takes ~30-50s (cold start)
- For a portfolio project this is fine: visitor opens dashboard → backend wakes → data flows
- The UI should show a "waking up backend..." state during cold start

## Backend Changes (Incremental Refactor)

### Keep As-Is
- `app/config.py` - Pydantic settings, env validation
- `app/logging_config.py` - structlog JSON logging
- `app/process_manager.py` - subprocess supervision
- `app/producer/` - Finnhub client + Kafka sink (entire subpackage)
- `app/consumer/` - Kafka source + JSONL writer (entire subpackage)
- `tests/` - all 66 existing tests
- `requirements.txt` / `requirements-dev.txt`
- `pyproject.toml`
- `.github/workflows/ci.yml` (extend, don't replace)

### Delete
- `deploy/bootstrap.sh` - Hetzner-specific server setup
- `deploy/stonks-in-motion.service` - systemd unit
- `deploy/README.md` - Hetzner deploy guide
- `.github/workflows/deploy.yml` - Hetzner SSH deploy
- `scripts/generate_deploy_key.sh` - SSH keypair generator
- `app/templates/index.html` - old Jinja2 template
- `app/static/app.js` - old vanilla JS

### Modify

**`app/main.py`**
- Add `CORSMiddleware` for GitHub Pages origin (and localhost for dev)
- Remove Jinja2 `templates` directory mounting
- Remove `StaticFiles` mount for `app/static/`
- Keep lifespan context manager and process manager integration

**`app/routes.py`**
- Add SSE (Server-Sent Events) endpoint `/api/stream` for real-time data push
  - Replaces 2-second polling with push-based updates
  - Streams latest quotes and pipeline status as they arrive
  - Falls back gracefully if connection drops
- Add `/api/quotes/history` endpoint returning recent quote data for charts
- Keep existing `/api/start`, `/api/stop`, `/api/status`, `/api/logs`, `/healthz`

### Add

**`render.yaml`** - Render Blueprint
```yaml
services:
  - type: web
    name: stonks-in-motion
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: FINNHUB_API_KEY
        sync: false
      - key: KAFKA_BOOTSTRAP_SERVERS
        sync: false
      # ... other env vars from .env.example
    plan: free
```

## Frontend (New React SPA)

### Tech Stack
- **React 19** + **Vite** - build tooling
- **Tremor** - dashboard UI components (built on Recharts + Tailwind)
- **Tailwind CSS** - via Tremor dependency
- **TypeScript** - type safety

### Directory Structure
```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── api.ts              # Backend API client + SSE hook
    ├── types.ts             # Quote, PipelineStatus types
    ├── components/
    │   ├── Dashboard.tsx    # Main layout
    │   ├── KpiCards.tsx     # Price, change %, uptime cards
    │   ├── PriceChart.tsx   # Area chart per ticker
    │   ├── Controls.tsx     # Start/Stop buttons + status
    │   ├── MessageTable.tsx # Live Kafka message stream
    │   └── ColdStart.tsx    # "Waking up backend..." overlay
    └── hooks/
        └── useStream.ts     # SSE connection hook
```

### Dashboard Layout

```
┌──────────────────────────────────────────────────────┐
│  stonks-in-motion          [Start] [Stop]  ● Running │
├──────────┬──────────┬──────────┬─────────────────────┤
│  AAPL    │  MSFT    │  GOOGL   │  Pipeline           │
│  $189.50 │  $428.12 │  $178.90 │  Uptime: 2h 30m     │
│  +1.2%   │  -0.3%   │  +0.8%   │  Messages: 1,247    │
│  ▁▂▃▅▇   │  ▇▅▃▂▁   │  ▁▃▅▃▅   │  Throughput: 6/min  │
├──────────┴──────────┴──────────┴─────────────────────┤
│  Price History                               [1h|4h] │
│  ┌─────────────────────────────────────────────────┐ │
│  │          ╱╲    ╱╲                               │ │
│  │    ╱╲  ╱    ╲╱    ╲  ╱╲                         │ │
│  │  ╱    ╲              ╲  ╲╱                      │ │
│  └─────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│  Recent Messages                                     │
│  ┌────────┬────────┬──────────┬───────┬─────────┐   │
│  │ Time   │ Symbol │ Price    │ Chg%  │ Offset  │   │
│  ├────────┼────────┼──────────┼───────┼─────────┤   │
│  │ 14:30  │ AAPL   │ $189.50  │ +1.2% │ 1247    │   │
│  │ 14:30  │ MSFT   │ $428.12  │ -0.3% │ 1246    │   │
│  │ 14:29  │ GOOGL  │ $178.90  │ +0.8% │ 1245    │   │
│  └────────┴────────┴──────────┴───────┴─────────┘   │
└──────────────────────────────────────────────────────┘
```

### Key UI Features

1. **KPI Cards** (Tremor `Card` + `Metric` + `SparkAreaChart`)
   - One per ticker showing current price, daily change %, sparkline
   - Pipeline card showing uptime, message count, throughput

2. **Price Chart** (Tremor `AreaChart`)
   - Multi-series area chart with all tickers
   - Time range selector (1h, 4h, session)
   - Tooltip with exact values on hover

3. **Controls** (Tremor `Button`)
   - Start/Stop pipeline
   - Visual status indicator (green dot running, gray stopped)
   - Disabled states during API calls

4. **Message Table** (Tremor `Table`)
   - Live-updating table of recent Kafka messages
   - Auto-scroll, max 50 rows visible

5. **Cold Start Overlay**
   - Detects when backend is sleeping (request timeout > 5s)
   - Shows loading state: "Waking up the pipeline backend..."
   - Disappears once `/healthz` responds

6. **Dark Mode**
   - System preference detection via `prefers-color-scheme`
   - Tremor has built-in dark mode support

### Data Flow (SSE)

```
Browser                    Render (FastAPI)
  │                            │
  ├──GET /api/stream──────────►│
  │                            ├── reads latest quotes from memory/file
  │◄──event: quote ───────────┤
  │   data: {"symbol":"AAPL"}  │
  │                            │
  │◄──event: status ──────────┤
  │   data: {"running":true}   │
  │                            │
  │  (connection kept open)    │
  │◄──event: quote ───────────┤  (every poll interval)
  ...                         ...
```

- SSE over HTTP/2 (single connection, server pushes events)
- Fallback: if SSE fails, fall back to polling `/api/status` + `/api/logs` every 3s
- Backend reads from in-memory buffer or consumer.jsonl tail

## CI/CD

### GitHub Actions (updated)

**`ci.yml`** - add frontend steps:
```yaml
# Existing Python CI stays
# Add:
- name: Install frontend deps
  working-directory: frontend
  run: npm ci
- name: Lint frontend
  working-directory: frontend
  run: npm run lint
- name: Build frontend
  working-directory: frontend
  run: npm run build
```

**`deploy-pages.yml`** (new) - deploy frontend to GitHub Pages:
- Trigger: push to main (frontend/ changes)
- Build React app with `VITE_API_URL` env var pointing to Render URL
- Deploy to GitHub Pages via `actions/deploy-pages@v4`

**Render auto-deploy:**
- Render.com natively watches the GitHub repo
- Auto-deploys on push to main
- No custom workflow needed

## Environment Variables

### Backend (Render.com dashboard)
All existing env vars from `.env.example` stay. Add:
- `CORS_ORIGINS` - comma-separated allowed origins (GitHub Pages URL + localhost)

### Frontend (build-time)
- `VITE_API_URL` - Render.com service URL (e.g., `https://stonks-in-motion.onrender.com`)

## Migration Steps (High Level)

1. **Backend cleanup** - delete Hetzner deploy stuff, add CORS, add SSE endpoint
2. **Frontend scaffold** - React + Vite + Tremor + Tailwind in `frontend/`
3. **Dashboard components** - KPI cards, charts, controls, message table
4. **API integration** - connect frontend to backend via SSE + REST
5. **Cold start UX** - handle Render.com wake-up gracefully
6. **CI/CD** - update ci.yml, add deploy-pages.yml, add render.yaml
7. **README update** - new architecture docs, local dev instructions
8. **Test & verify** - existing backend tests pass, frontend builds, E2E works

## Verification

- All 66 existing Python tests pass (`pytest`)
- `ruff check .` and `ruff format --check .` pass
- Frontend builds successfully (`npm run build`)
- Frontend lints clean (`npm run lint`)
- Local dev works: backend on :8000, frontend on :5173 with proxy
- Start/Stop controls work through the UI
- SSE stream delivers real-time quote data
- Cold start overlay appears and disappears correctly
- Dark mode works
- Dashboard is responsive (mobile + desktop)
- GitHub Pages deployment serves the built SPA
- Render.com deploys and responds to `/healthz`
