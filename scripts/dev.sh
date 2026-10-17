#!/usr/bin/env bash
# One command to run what you own locally. Usage: scripts/dev.sh backend | web | ml
set -e
case "$1" in
  backend)
    cd backend && python -m venv .venv 2>/dev/null || true && . .venv/bin/activate && pip install -q -r requirements.txt && uvicorn app.main:app --reload --port 8000 ;;
  web)
    cd web && npm install && npm run dev ;;
  ml)
    cd ml && python -m venv .venv 2>/dev/null || true && . .venv/bin/activate && pip install -q -r requirements.txt && echo "ml env ready" ;;
  *)
    echo "usage: scripts/dev.sh backend|web|ml" ;;
esac
