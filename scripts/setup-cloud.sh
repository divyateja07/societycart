#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p /workspace/.cache/npm /workspace/.cache/maven /workspace/toolchains
if [[ ! -x /workspace/apache-maven-3.9.11/bin/mvn ]]; then
 curl -fsSL https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.tar.gz -o /workspace/.cache/maven.tar.gz
 curl -fsSL https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.tar.gz.sha512 -o /workspace/.cache/maven.sha512
 python3 - <<'PY'
import hashlib,pathlib
p=pathlib.Path('/workspace/.cache')
assert hashlib.sha512((p/'maven.tar.gz').read_bytes()).hexdigest()==(p/'maven.sha512').read_text().strip(),'Maven checksum mismatch'
PY
 tar -xzf /workspace/.cache/maven.tar.gz -C /workspace
fi
if [[ ! -x /workspace/toolchains/jdk-21/bin/javac ]]; then
 docker pull maven:3.9.11-eclipse-temurin-21
 jdk_container=$(docker create maven:3.9.11-eclipse-temurin-21)
 trap 'docker rm "$jdk_container" >/dev/null' EXIT
 docker cp "$jdk_container:/opt/java/openjdk" /workspace/toolchains/jdk-21
 docker rm "$jdk_container" >/dev/null
 trap - EXIT
fi
npm --prefix frontend ci --cache /workspace/.cache/npm
scripts/maven.sh -DskipTests package
npm --prefix frontend run build
scripts/bootstrap-local.sh
scripts/build-cloud.sh
