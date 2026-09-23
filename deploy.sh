#!/bin/sh
set -eu
cd "$(dirname "$0")"
domain="${1:-}"
if ! printf '%s' "$domain" | grep -Eq '^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$'; then
  echo 'Usage: sh deploy.sh akim.your-domain.com (without https:// or path)' >&2
  exit 1
fi
if [ ! -f .server.env ]; then
  echo 'Missing .server.env: use the complete server package.' >&2
  exit 1
fi
command -v docker >/dev/null 2>&1 || { echo 'Install Docker Engine and Compose first.' >&2; exit 1; }
docker compose version >/dev/null
chmod 600 .server.env
# Domain is restricted to hostname characters before insertion.
sed "s/^DOMAIN=.*/DOMAIN=$domain/" .server.env > .server.env.tmp
chmod 600 .server.env.tmp
mv .server.env.tmp .server.env
docker compose --env-file .server.env -f compose.server.yaml config --quiet
docker compose --env-file .server.env -f compose.server.yaml up -d --build
echo "Containers started. HTTPS will be ready after certificate issuance: https://$domain"
docker compose --env-file .server.env -f compose.server.yaml ps
