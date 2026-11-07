#!/usr/bin/env bash
set -e

echo "==> Running database migrations with Alembic..."
alembic upgrade head

echo "==> Starting DUMMR API server..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "${WEB_CONCURRENCY:-2}"
