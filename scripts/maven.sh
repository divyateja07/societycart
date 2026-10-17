#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "${SOCIETYCART_JAVA_HOME:-}" ]]; then
 export JAVA_HOME="$SOCIETYCART_JAVA_HOME"
elif [[ -x /workspace/toolchains/jdk-21/bin/javac ]]; then
 export JAVA_HOME=/workspace/toolchains/jdk-21
elif [[ -z "${JAVA_HOME:-}" ]]; then
 export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
fi
if [[ -f /etc/ssl/certs/java/cacerts ]]; then export MAVEN_OPTS="${MAVEN_OPTS:-} -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts"; fi
cache="${SOCIETYCART_CACHE:-/workspace/.cache}"
mkdir -p "$cache/maven"
maven="${MAVEN_CMD:-/workspace/apache-maven-3.9.11/bin/mvn}"
if [[ ! -x "$maven" ]]; then maven=mvn; fi
settings=()
if [[ -n "${HTTPS_PROXY:-}" ]]; then
 python3 - "$cache/maven-settings.xml" <<'PY'
import os,sys,urllib.parse,xml.sax.saxutils as xml
u=urllib.parse.urlsplit(os.environ['HTTPS_PROXY'])
if u.username or u.password: raise SystemExit('Authenticated proxy requires secure Maven configuration')
open(sys.argv[1],'w').write(f'<settings><proxies><proxy><id>environment</id><active>true</active><protocol>http</protocol><host>{xml.escape(u.hostname)}</host><port>{u.port or 80}</port></proxy></proxies></settings>')
PY
 settings=(-s "$cache/maven-settings.xml")
fi
exec "$maven" "${settings[@]}" -Dmaven.repo.local="$cache/maven" -B -f backend/pom.xml "$@"
