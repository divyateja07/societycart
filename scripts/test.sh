#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?Point DATABASE_URL at a disposable PostgreSQL database}"
: "${DATABASE_PASSWORD:?Point DATABASE_URL and DATABASE_PASSWORD at a disposable PostgreSQL database}"
DEMO_MODE=true scripts/maven.sh test
npm --prefix frontend test
npm --prefix frontend run build
