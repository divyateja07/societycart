#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export DOCKER_CONFIG="${DOCKER_CONFIG:-/workspace/.cache/docker}"
scripts/bootstrap-local.sh
docker compose up -d --no-build --wait --wait-timeout 90
curl --fail --silent --show-error http://127.0.0.1:8080/actuator/health
curl --fail --silent --show-error http://127.0.0.1:5173/ > /dev/null
printf '\nDatabase, backend health, and frontend HTTP checks passed.\n'
