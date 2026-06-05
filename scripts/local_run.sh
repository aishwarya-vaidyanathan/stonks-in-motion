#!/usr/bin/env bash
# Convenience: run the web app locally with the same env layout as production.
# Reads .env from the repo root (creating it from .env.example if missing).
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "No .env found; copying from .env.example. Edit it before relying on real data."
  cp .env.example .env
fi

# shellcheck disable=SC1091
set -a; source .env; set +a

exec ./.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
