#!/bin/bash
set -e

# Integration test runner for chat21-server analytics events.
#
# Usage:
#   bash scripts/test-integration.sh [--keep-containers]
#
# Starts RabbitMQ and MongoDB via Docker Compose, waits until they are
# healthy, runs the integration test suite, then tears everything down.
# Pass --keep-containers to skip the docker compose down step (useful for
# debugging failing tests).

KEEP_CONTAINERS=false
for arg in "$@"; do
  if [ "$arg" = "--keep-containers" ]; then
    KEEP_CONTAINERS=true
  fi
done

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Tear down any leftover containers and volumes from a previous run so we start
# with a clean RabbitMQ state (avoids .erlang.cookie permission errors).
echo "==> Cleaning up any previous containers and volumes..." >&2
docker compose -f "$REPO_ROOT/docker-compose.yml" down -v --remove-orphans 2>/dev/null || true

echo "==> Starting services via Docker Compose..." >&2
docker compose -f "$REPO_ROOT/docker-compose.yml" up -d

# ── Wait for RabbitMQ ────────────────────────────────────────────────────────
echo "==> Waiting for RabbitMQ to become healthy..." >&2
RETRIES=30
until docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T rabbitmq \
      rabbitmq-diagnostics ping --quiet 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -eq 0 ]; then
    echo "ERROR: RabbitMQ did not become ready in time." >&2
    docker compose -f "$REPO_ROOT/docker-compose.yml" logs rabbitmq >&2
    docker compose -f "$REPO_ROOT/docker-compose.yml" down -v
    exit 1
  fi
  echo "  RabbitMQ not ready yet, retrying in 3s... ($RETRIES retries left)" >&2
  sleep 3
done
echo "  RabbitMQ is ready." >&2

# ── Wait for MongoDB ─────────────────────────────────────────────────────────
echo "==> Waiting for MongoDB to become healthy..." >&2
RETRIES=30
until docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T mongodb \
      mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -eq 0 ]; then
    echo "ERROR: MongoDB did not become ready in time." >&2
    docker compose -f "$REPO_ROOT/docker-compose.yml" logs mongodb >&2
    docker compose -f "$REPO_ROOT/docker-compose.yml" down -v
    exit 1
  fi
  echo "  MongoDB not ready yet, retrying in 3s... ($RETRIES retries left)" >&2
  sleep 3
done
echo "  MongoDB is ready." >&2

# ── Run tests ────────────────────────────────────────────────────────────────
echo "==> Running integration tests..." >&2
EXIT_CODE=0
RABBITMQ_URI=amqp://guest:guest@localhost:5672 \
MONGODB_URI=mongodb://localhost:27017/chat21_integration_test \
  npm --prefix "$REPO_ROOT" run test:integration || EXIT_CODE=$?

# ── Teardown ─────────────────────────────────────────────────────────────────
if [ "$KEEP_CONTAINERS" = "false" ]; then
  echo "==> Stopping and removing containers and volumes..." >&2
  docker compose -f "$REPO_ROOT/docker-compose.yml" down -v
fi

exit "$EXIT_CODE"
