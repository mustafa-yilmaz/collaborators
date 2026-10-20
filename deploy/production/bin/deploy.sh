#!/usr/bin/env bash
# Deploys Collaborators from this computer to the server:
#
#   deploy/production/bin/deploy.sh <server ip> --prepare   # first time only
#   deploy/production/bin/deploy.sh <server ip>             # every release
#
# Copies the code (not the secrets, keys or data, which stay on the server),
# builds the images there, migrates the databases and restarts what changed.
# Uses the deploy key ~/.ssh/collaborators_hetzner.

set -euo pipefail
SERVER="${1:?usage: deploy.sh <server ip> [--prepare]}"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SSH=(ssh -i ~/.ssh/collaborators_hetzner -o StrictHostKeyChecking=accept-new "root@${SERVER}")
REMOTE=/opt/collaborators

if [[ "${2:-}" == "--prepare" ]]; then
  "${SSH[@]}" "bash -s" < "${ROOT}/deploy/production/bin/prepare-server.sh"
fi

echo "Copying the code…"
rsync -az --delete \
  -e "ssh -i ${HOME}/.ssh/collaborators_hetzner" \
  --exclude .git --exclude .claude --exclude node_modules --exclude .next \
  --exclude /data --exclude /env.d/development/'*.local' \
  --exclude /deploy/production/env/'*.env' --exclude /deploy/production/env/.secrets \
  --exclude /deploy/production/keys --exclude /deploy/production/data \
  --exclude /deploy/production/keycloak/import \
  --exclude /deploy/production/.env \
  --exclude '__pycache__' --exclude .venv \
  "${ROOT}/" "root@${SERVER}:${REMOTE}/"

echo "Building and starting…"
"${SSH[@]}" "cd ${REMOTE}/deploy/production && set -e
  test -f env/app.env || { echo 'Run bin/init.sh <domain> <email> on the server first.'; exit 1; }
  docker compose build
  docker compose up -d postgresql redis yhub-valkey minio
  docker compose run --rm minio-bucket
  docker compose run --rm yhub yarn init-db
  docker compose run --rm backend python manage.py migrate --noinput
  docker compose up -d --remove-orphans
  docker image prune -f >/dev/null
  docker compose ps --format 'table {{.Service}}\t{{.Status}}'"
