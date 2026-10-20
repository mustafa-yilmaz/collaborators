#!/usr/bin/env bash
# First-time setup of Collaborators on the server, run once from
# deploy/production:
#
#   bin/init.sh collaborators.community you@example.org
#
# Makes env/*.env from the templates with fresh random secrets, the signing
# keys of the backend and of the collaboration server, and the Keycloak realm
# to import. Never overwrites what exists: run it again safely. Secrets stay
# on this server; nothing is printed.

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE="usage: bin/init.sh <domain> <email for the HTTPS certificates>"
APP_HOST="${1:?${USAGE}}"
ACME_EMAIL="${2:?${USAGE}}"
AUTH_HOST="auth.${APP_HOST}"

random() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "${1:-40}"; }

SECRETS_FILE=env/.secrets
umask 077
if [[ ! -f "${SECRETS_FILE}" ]]; then
  {
    echo "DJANGO_SECRET_KEY=$(random 60)"
    echo "DB_PASSWORD=$(random 32)"
    echo "MINIO_PASSWORD=$(random 32)"
    echo "Y_PROVIDER_API_KEY=$(random 40)"
    echo "OIDC_CLIENT_SECRET=$(random 40)"
    echo "KEYCLOAK_BACKEND_SECRET=$(random 40)"
    echo "KEYCLOAK_ADMIN_PASSWORD=$(random 24)"
  } > "${SECRETS_FILE}"
  echo "Made the secrets (${SECRETS_FILE})"
fi
# shellcheck disable=SC1090
source "${SECRETS_FILE}"

fill() {
  sed -e "s|__APP_HOST__|${APP_HOST}|g" \
      -e "s|__AUTH_HOST__|${AUTH_HOST}|g" \
      -e "s|__ACME_EMAIL__|${ACME_EMAIL}|g" \
      -e "s|__DJANGO_SECRET_KEY__|${DJANGO_SECRET_KEY}|g" \
      -e "s|__DB_PASSWORD__|${DB_PASSWORD}|g" \
      -e "s|__MINIO_PASSWORD__|${MINIO_PASSWORD}|g" \
      -e "s|__Y_PROVIDER_API_KEY__|${Y_PROVIDER_API_KEY}|g" \
      -e "s|__OIDC_CLIENT_SECRET__|${OIDC_CLIENT_SECRET}|g" \
      -e "s|__KEYCLOAK_BACKEND_SECRET__|${KEYCLOAK_BACKEND_SECRET}|g" \
      -e "s|__KEYCLOAK_ADMIN_PASSWORD__|${KEYCLOAK_ADMIN_PASSWORD}|g" \
      "$1"
}

for template in env/*.env.template; do
  target="${template%.template}"
  if [[ ! -s "${target}" ]]; then
    fill "${template}" > "${target}.tmp"
    mv "${target}.tmp" "${target}"
    echo "Made ${target}"
  fi
done

# What compose.yaml reads itself (the frontend's address, built in)
if [[ ! -f .env ]]; then
  echo "APP_HOST=${APP_HOST}" > .env
  echo "Made .env"
fi

# The signing keys: the backend's and the collaboration server's, never the same
mkdir -p keys
for key in private yhub-private; do
  if [[ ! -f "keys/${key}.pem" ]]; then
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "keys/${key}.pem" 2>/dev/null
    echo "Made keys/${key}.pem"
  fi
done
chmod 600 keys/*.pem
sudo chown 1000:1000 keys/*.pem 2>/dev/null || chown 1000:1000 keys/*.pem

# The Keycloak realm, imported on its first start
mkdir -p keycloak/import
# Keycloak (uid 1000) reads it: not private like the rest (umask 077)
chmod 755 keycloak/import
if [[ ! -f keycloak/import/collaborators-realm.json ]]; then
  APP_HOST="${APP_HOST}" OIDC_CLIENT_SECRET="${OIDC_CLIENT_SECRET}" \
    python3 bin/make-realm.py ../../docker/auth/realm.json \
    > keycloak/import/collaborators-realm.json
  chmod 644 keycloak/import/collaborators-realm.json
  echo "Made the Keycloak realm (keycloak/import/collaborators-realm.json)"
fi

# Where the services keep their data
mkdir -p data/{postgres,minio,yhub-valkey,caddy,backups}
sudo chown -R 1000:1000 data/minio 2>/dev/null || true

echo "Done. Fill in the <…> values of env/app.env (email), then run bin/deploy.sh."
