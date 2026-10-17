#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export DOCKER_CONFIG="${DOCKER_CONFIG:-/workspace/.cache/docker}"
mkdir -p "$DOCKER_CONFIG" .local
args=(-f docker-compose.yml)
if [[ -n "${HTTPS_PROXY:-}" ]]; then
 python3 - <<'PY'
import os,socket,urllib.parse,pathlib,json
u=urllib.parse.urlsplit(os.environ['HTTPS_PROXY'])
if u.username or u.password: raise SystemExit('Use secure platform proxy configuration; credentials must not be saved in helper files')
ip=socket.gethostbyname(u.hostname)
# Secrets are mounted only while building, never copied into images.
pathlib.Path('.local/compose.cloud.yml').write_text('''services:
  backend:
    build:
      extra_hosts: ["HOST:IP"]
      secrets: [maven_settings, java_truststore]
  frontend:
    build:
      extra_hosts: ["HOST:IP"]
      secrets: [system_ca]
secrets:
  maven_settings:
    file: /workspace/.cache/maven-settings.xml
  java_truststore:
    file: /etc/ssl/certs/java/cacerts
  system_ca:
    file: /etc/ssl/certs/ca-certificates.crt
'''.replace('HOST',u.hostname).replace('IP',ip))
PY
 args+=(-f .local/compose.cloud.yml)
fi
docker compose "${args[@]}" build --build-arg HTTP_PROXY --build-arg HTTPS_PROXY
