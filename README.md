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
- [ ] V1b — Finnhub REST poller + confluent-kafka producer
- [ ] V1c — Kafka consumer writing JSON log file
- [ ] V1d — Web Start/Stop controls + status + log tail
- [ ] V1e — `systemd` unit + GitHub Actions CI/SSH deploy + server bootstrap

## Quickstart (local development)

```bash
git clone git@github.com:aishwarya-vaidyanathan/stonks-in-motion.git
cd stonks-in-motion

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

cp .env.example .env
# Edit .env and set FINNHUB_API_KEY and KAFKA_* values.

uvicorn app.main:app --reload
```

Open <http://127.0.0.1:8000/> for the dashboard and <http://127.0.0.1:8000/healthz> for the liveness probe.

## Running tests

```bash
pytest
ruff check .
```

## Configuration

All configuration is environment-variable driven. See [`.env.example`](.env.example) for the full list. The most important ones:

| Var | Purpose |
|---|---|
| `FINNHUB_API_KEY` | Free API key from finnhub.io |
| `FINNHUB_TICKERS` | JSON list or CSV of symbols, e.g. `["AAPL","MSFT"]` or `AAPL,MSFT` |
| `FINNHUB_POLL_INTERVAL_SECONDS` | How often to fetch each ticker (default 5s) |
| `KAFKA_BOOTSTRAP_SERVERS` | `host:port` from the Aiven console |
| `KAFKA_SASL_USERNAME` / `KAFKA_SASL_PASSWORD` | Aiven service user |
| `KAFKA_TOPIC` | Default `stonks.raw.quotes` |
| `KAFKA_TRANSPORT` | `native` (confluent-kafka) or `rest` (stubbed) |

## Tech stack

Python 3.11+, FastAPI, Jinja2, pydantic-settings, httpx, confluent-kafka, structlog, `pytest`, `ruff`.
