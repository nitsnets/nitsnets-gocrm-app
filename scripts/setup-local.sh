#!/usr/bin/env bash
set -euo pipefail
CRM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$CRM_ROOT"
npm ci
composer install --working-dir=apps/api --no-interaction
npm ci --prefix apps/web
bash scripts/db.sh start
if [[ ! -f apps/api/.env ]]; then
  cp apps/api/.env.example apps/api/.env
  CRM_SETUP_PORT="${CRM_PG_PORT:-55439}" python3 - <<'PY'
from pathlib import Path
import os
p=Path('apps/api/.env')
lines=p.read_text().splitlines()
values={'APP_ENV':'local','APP_DEBUG':'true','APP_URL':'http://127.0.0.1:8000','DB_CONNECTION':'pgsql','DB_HOST':'127.0.0.1','DB_PORT':os.environ['CRM_SETUP_PORT'],'DB_DATABASE':'nitsnets_crm','DB_USERNAME':'crm_local','DB_PASSWORD':'','QUEUE_CONNECTION':'database','DB_QUEUE_RETRY_AFTER':'360'}
for key,value in values.items():
    lines=[line for line in lines if not line.startswith(key+'=')]
    lines.append(key+'='+value)
p.write_text('\n'.join(lines)+'\n')
PY
  (cd apps/api && php artisan key:generate --force && php artisan migrate --seed)
else
  echo "Se conserva apps/api/.env existente. Ejecuta migraciones/seed explícitamente si corresponde."
fi
if [[ ! -f apps/web/.env.local ]]; then cp apps/web/.env.example apps/web/.env.local; fi
echo "Preparado. Arranque: npm run dev. Web: http://127.0.0.1:3000"
