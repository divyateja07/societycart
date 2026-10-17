#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
import pathlib,secrets,os
p=pathlib.Path('.env')
if not p.exists():
 fd=os.open(p,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
 with os.fdopen(fd,'w') as f:
  f.write('DATABASE_PASSWORD='+secrets.token_urlsafe(24)+'\nADMIN_EMAIL=admin@example.test\nADMIN_PASSWORD='+secrets.token_urlsafe(24)+'\nDEMO_MODE=true\nPAYMENT_PROVIDER=simulated\nCOOKIE_SECURE=false\n')
 print('Created ignored .env with unique development credentials. Read ADMIN_PASSWORD locally to sign in; do not share it.')
else: print('Preserved existing .env')
PY
