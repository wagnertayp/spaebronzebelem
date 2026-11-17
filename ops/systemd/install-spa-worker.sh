#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="/etc/spaebronzebelem.env"
service_source="$root_dir/ops/systemd/spa-worker.service"
service_target="/etc/systemd/system/spa-worker.service"
worker_entry="$root_dir/artifacts/api-server/dist/worker.mjs"

if [[ ! -f "$env_file" ]]; then
  echo "Missing environment file: $env_file" >&2
  exit 1
fi

if [[ ! -f "$worker_entry" ]]; then
  echo "Missing built worker: $worker_entry. Build the app first." >&2
  exit 1
fi

if ! sudo grep -q '^WHATSAPP_WEBHOOK_WORKER_CUTOFF_AT=' "$env_file"; then
  cutoff="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  printf 'WHATSAPP_WEBHOOK_WORKER_CUTOFF_AT=%s\n' "$cutoff" |
    sudo tee -a "$env_file" >/dev/null
fi

sudo install -o root -g root -m 0644 "$service_source" "$service_target"
sudo systemctl daemon-reload
sudo systemctl enable --now spa-worker
sudo systemctl status spa-worker --no-pager
