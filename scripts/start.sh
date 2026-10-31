#!/usr/bin/env bash
# Starts all three services (macOS/Linux). Ctrl+C stops them.
cd "$(dirname "$0")/.."
trap 'kill 0' EXIT
(cd backend && npm run dev) &
(cd ai-service && { [ -f .venv/bin/activate ] && . .venv/bin/activate; python3 run.py; }) &
(cd frontend && npm run dev) &
wait
