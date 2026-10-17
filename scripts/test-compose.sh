#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export DOCKER_CONFIG="${DOCKER_CONFIG:-/workspace/.cache/docker}"
if ! docker compose exec -T postgres psql -U societycart -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='societycart_test'" | rg -q 1; then
 docker compose exec -T postgres createdb -U societycart societycart_test
fi
python3 - <<'PY'
import os,pathlib,subprocess
config=dict(line.split('=',1) for line in pathlib.Path('.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
env=dict(os.environ,DATABASE_URL='jdbc:postgresql://localhost:5432/societycart_test',DATABASE_USER='societycart',DATABASE_PASSWORD=config['DATABASE_PASSWORD'],DEMO_MODE='true')
raise SystemExit(subprocess.run(['scripts/test.sh'],env=env).returncode)
PY
