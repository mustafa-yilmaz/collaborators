#!/usr/bin/env bash
# Nightly backup, on the server (cron, see prepare-server.sh): all the
# databases, the files (MinIO), and the secrets and keys, into
# data/backups/<date>/. Keeps 14 days. Copy them off the server too: turn on
# the server's backups at Hetzner, or sync data/backups elsewhere.

set -euo pipefail
cd "$(dirname "$0")/.."
DAY="$(date +%Y-%m-%d)"
TARGET="data/backups/${DAY}"
mkdir -p "${TARGET}"

docker compose exec -T postgresql sh -c 'pg_dumpall -U "$POSTGRES_USER"' \
  | gzip > "${TARGET}/databases.sql.gz"
tar -czf "${TARGET}/files.tar.gz" -C data minio
tar -czf "${TARGET}/secrets.tar.gz" env keys keycloak/import
chmod -R go-rwx "${TARGET}"

find data/backups -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
echo "$(date -Is) backup ${TARGET}: $(du -sh "${TARGET}" | cut -f1)"
