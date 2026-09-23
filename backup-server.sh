#!/bin/sh
set -eu
cd "$(dirname "$0")"
umask 077
mkdir -p server-backups
file="server-backups/akim-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose --env-file .server.env -f compose.server.yaml exec -T db pg_dump -U postgres -d akim -Fc > "$file"
echo "Database backup saved: $file"
