#!/usr/bin/env bash
set -euo pipefail
CRM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ ! -f "$CRM_ROOT/apps/api/.env" ]]; then
  echo "Configura apps/api/.env siguiendo README.md antes de arrancar." >&2
  exit 1
fi
CRM_PIDS=()
cleanup() {
  for crm_pid in "${CRM_PIDS[@]}"; do kill "$crm_pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM
echo "Web: http://127.0.0.1:3000"
echo "API: http://127.0.0.1:3000/api/v1 (Laravel interno en 127.0.0.1:8000)"
(cd "$CRM_ROOT/apps/api" && exec php artisan serve --host=127.0.0.1 --port=8000 --tries=1) &
CRM_PIDS+=("$!")
(cd "$CRM_ROOT/apps/api" && exec php artisan queue:work --tries=3 --timeout=300) &
CRM_PIDS+=("$!")
(cd "$CRM_ROOT/apps/api" && exec php artisan schedule:work) &
CRM_PIDS+=("$!")
(cd "$CRM_ROOT/apps/web" && exec npm run dev -- --hostname 127.0.0.1 --port 3000) &
CRM_PIDS+=("$!")
wait
