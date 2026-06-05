# stonks-in-motion

> Turning stonks into streams with Finnhub and Kafka for real-time analytics and experimentation.

A small but production-shaped streaming pipeline:

- **Producer** polls the free [Finnhub](https://finnhub.io/) REST API for stock quotes on a schedule.
- **Aiven Kafka** (free tier) holds the messages on a topic.
- **Consumer** tails that topic and writes a structured JSON log.
- A **FastAPI** web UI exposes **Start / Stop** controls and a live status panel.
- One Python process supervises both worker subprocesses and is itself managed by `systemd` on a Hetzner Ubuntu box.

## Architecture (V1)

```
            Hetzner (Ubuntu 26.04)
            +-----------------------------------------+
            |  systemd                                |
            |   └─ uvicorn app.main:app               |
            |        ├─ producer (subprocess)         |
            |        │     Finnhub REST -> Aiven Kafka|
            |        └─ consumer (subprocess)         |
            |              Aiven Kafka -> JSON log    |
            +-------------------^---------------------+
                                |   HTTP (127.0.0.1:8000)
                                |
                          Browser UI
```

## Status

- [x] V1a — Project scaffold, config, structured logging, FastAPI shell, smoke tests
- [x] V1b — Finnhub REST poller + confluent-kafka producer
- [x] V1c — Kafka consumer writing JSON log file
- [x] V1d — Web Start/Stop controls + status + log tail
- [x] V1e — `systemd` unit + GitHub Actions CI/SSH deploy + server bootstrap

## Repo layout

```
app/                  # FastAPI app, producer, consumer, process manager
  main.py             # FastAPI entry point (uvicorn target)
  config.py           # pydantic-settings, reads .env
  logging_config.py   # structlog -> JSON
  routes.py           # /api/start, /api/stop, /api/status, /api/logs
  process_manager.py  # Supervises producer + consumer subprocesses
  producer/           # python -m app.producer
  consumer/           # python -m app.consumer
  templates/          # Jinja2 dashboard
  static/             # tiny vanilla-JS poller
deploy/               # systemd unit + bootstrap.sh
scripts/              # generate_deploy_key.sh, local_run.sh
tests/                # pytest
.github/workflows/    # ci.yml (lint+test) + deploy.yml (SSH)
```

## Quickstart (local development)

```bash
git clone git@github.com:aishwarya-vaidyanathan/stonks-in-motion.git
cd stonks-in-motion

# 3.12 or newer required
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

cp .env.example .env
# Edit .env and set FINNHUB_API_KEY and KAFKA_* values.

bash scripts/local_run.sh
# Or:  uvicorn app.main:app --reload
```

Open <http://127.0.0.1:8000/> for the dashboard and <http://127.0.0.1:8000/healthz> for the liveness probe.

## Running tests

```bash
pytest
ruff check .
ruff format --check .
```

## Configuration

All configuration is environment-variable driven. See [`.env.example`](.env.example) for the full list. The most important ones:

| Var | Purpose |
|---|---|
| `FINNHUB_API_KEY` | Free API key from finnhub.io |
| `FINNHUB_TICKERS` | JSON list or CSV of symbols, e.g. `["AAPL","MSFT"]` or `AAPL,MSFT` |
| `FINNHUB_POLL_INTERVAL_SECONDS` | How often to fetch each ticker (default 10s) |
| `KAFKA_BOOTSTRAP_SERVERS` | `host:port` from the Aiven console |
| `KAFKA_SASL_USERNAME` / `KAFKA_SASL_PASSWORD` | Aiven service user |
| `KAFKA_TOPIC` | Default `stonks.raw.quotes` |
| `KAFKA_TRANSPORT` | `native` (confluent-kafka) or `rest` (stubbed) |

## Deploy

See [`deploy/README.md`](deploy/README.md) for the full playbook. The short version:

1. `bash scripts/generate_deploy_key.sh` — generates an ed25519 keypair.
2. Create a Hetzner Cloud server (Ubuntu 24.04/26.04, Helsinki) and paste
   `deploy_key.pub` as the SSH key.
3. `scp deploy_key.pub deploy/bootstrap.sh root@<ip>:/tmp/` then
   `ssh root@<ip> "bash /tmp/bootstrap.sh /tmp/deploy_key.pub"`.
4. Add the secrets listed in `deploy/README.md` to GitHub.
5. Push to `main` — the deploy workflow rsyncs code, writes `.env` from
   secrets (mode 600), installs deps, restarts the service, and health-checks
   `/healthz`.

## Tech stack

Python 3.12, FastAPI, Jinja2, pydantic-settings, httpx, confluent-kafka,
structlog, vanilla JS, `pytest`, `ruff`. CI on GitHub Actions.
Deployment via `systemd` + `scp-action`/`ssh-action`.
