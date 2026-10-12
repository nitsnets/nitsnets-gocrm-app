#!/usr/bin/env bash
set -euo pipefail
CRM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRM_PG_BIN="${CRM_PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
CRM_PG_PORT="${CRM_PG_PORT:-55439}"
CRM_PG_DATA="$CRM_ROOT/.local/postgres"
if [[ ! -x "$CRM_PG_BIN/pg_ctl" ]]; then
  echo "No se encuentra PostgreSQL. Configura CRM_PG_BIN con la carpeta bin de PostgreSQL 16+." >&2
  exit 1
fi
mkdir -p "$CRM_ROOT/.local"
case "${1:-start}" in
  start)
    if [[ ! -f "$CRM_PG_DATA/PG_VERSION" ]]; then
      "$CRM_PG_BIN/initdb" -D "$CRM_PG_DATA" -U crm_local --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C > "$CRM_ROOT/.local/postgres-init.log"
    fi
    if ! "$CRM_PG_BIN/pg_ctl" -D "$CRM_PG_DATA" status >/dev/null 2>&1; then
      "$CRM_PG_BIN/pg_ctl" -D "$CRM_PG_DATA" -l "$CRM_ROOT/.local/postgres.log" -o "-p $CRM_PG_PORT -h 127.0.0.1" start
    fi
    if ! "$CRM_PG_BIN/psql" -h 127.0.0.1 -p "$CRM_PG_PORT" -U crm_local -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'nitsnets_crm'" | grep -q 1; then
      "$CRM_PG_BIN/createdb" -h 127.0.0.1 -p "$CRM_PG_PORT" -U crm_local nitsnets_crm
    fi
    echo "PostgreSQL local en 127.0.0.1:$CRM_PG_PORT, base nitsnets_crm, usuario crm_local. Solo desarrollo."
    ;;
  stop)
    if "$CRM_PG_BIN/pg_ctl" -D "$CRM_PG_DATA" status >/dev/null 2>&1; then
      "$CRM_PG_BIN/pg_ctl" -D "$CRM_PG_DATA" stop -m fast
    fi
    ;;
  *) echo "Uso: $0 start|stop" >&2; exit 1 ;;
esac
