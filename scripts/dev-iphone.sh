#!/usr/bin/env bash
set -euo pipefail
CRM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRM_IPHONE_PORT="${CRM_IPHONE_PORT:-8001}"

# Only physical LAN interfaces with RFC1918 addresses; never a wildcard/public bind.
CRM_IPHONE_ADDRESSES="$(python3 - <<'PY'
import ipaddress, os, re, subprocess
port = int(os.environ.get('CRM_IPHONE_PORT', '8001'))
if not 1024 <= port <= 65535:
    raise SystemExit('CRM_IPHONE_PORT debe estar entre 1024 y 65535.')
networks = [ipaddress.ip_network(n) for n in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')]
override = os.environ.get('CRM_IPHONE_BIND_ADDRESSES', '')
if override:
    addresses = override.replace(',', ' ').split()
else:
    output = subprocess.check_output(['/sbin/ifconfig', '-a'], text=True)
    addresses = []
    for block in re.split(r'(?=^\w[^\n]*: flags=)', output, flags=re.M):
        if re.match(r'en\d+:', block) and 'status: active' in block:
            addresses += re.findall(r'^\s+inet ([0-9.]+) ', block, flags=re.M)
addresses = list(dict.fromkeys(addresses))
if not addresses:
    raise SystemExit('No hay una red local activa. Conecta el Mac por Wi-Fi o Ethernet.')
for address in addresses:
    ip = ipaddress.ip_address(address)
    if not any(ip in network for network in networks):
        raise SystemExit('Solo se permiten direcciones IPv4 privadas de la red local.')
    print(address)
PY
)"

if [[ ! -f "$CRM_ROOT/apps/api/.env" ]]; then
  echo "Prepara el servidor siguiendo README.md antes de continuar." >&2
  exit 1
fi
CRM_LOCAL_NAME="$(scutil --get LocalHostName)"
CRM_PIDS=()
cleanup() {
  for crm_pid in "${CRM_PIDS[@]}"; do kill "$crm_pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

echo "Servidor de desarrollo para iPhone: http://$CRM_LOCAL_NAME.local:$CRM_IPHONE_PORT/api/v1"
echo "El Mac debe permanecer encendido y el iPhone en una de sus redes locales. Ctrl+C detiene este acceso."
for crm_address in $CRM_IPHONE_ADDRESSES; do
  echo "Escuchando únicamente en $crm_address:$CRM_IPHONE_PORT"
  (cd "$CRM_ROOT/apps/api" && APP_DEBUG=false exec php artisan serve --host="$crm_address" --port="$CRM_IPHONE_PORT" --tries=1 --no-reload) &
  CRM_PIDS+=("$!")
done
wait
