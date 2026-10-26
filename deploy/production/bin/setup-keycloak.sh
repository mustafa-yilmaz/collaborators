#!/usr/bin/env bash
# Sets up the production Keycloak realm: providers (Google, Microsoft,
# LinkedIn), email, account linking, the backend's service client. Runs the
# same script as development (bin/setup-sso-providers.sh at the repository
# root) with the production values. Run from deploy/production once Keycloak
# is up, and again after changing a provider's credentials (env/sso.env).

set -euo pipefail
cd "$(dirname "$0")/.."
HERE="$(pwd)"

# shellcheck disable=SC1091
source env/.secrets
smtp() { grep -E "^$1=" env/app.env | head -1 | cut -d= -f2- | tr -d '"'; }

export COMPOSE_FILE="${HERE}/compose.yaml"
export SSO_ENV_FILE="${HERE}/env/sso.env"
export KC_REALM=collaborators
export KC_APP_CLIENT=collaborators
export PRODUCTION=1
export KEYCLOAK_ADMIN=admin
export KEYCLOAK_ADMIN_PASSWORD
export KEYCLOAK_BACKEND_SECRET
# The MCP server people's own AI assistants connect to
export MCP_RESOURCE="https://collaborators.community/mcp"
SMTP_HOST="$(smtp DJANGO_EMAIL_HOST)"
if [[ "${SMTP_HOST}" == "<"* ]]; then SMTP_HOST=""; fi
export SMTP_HOST
SMTP_PORT="$(smtp DJANGO_EMAIL_PORT)"
SMTP_USER="$(smtp DJANGO_EMAIL_HOST_USER)"
SMTP_PASSWORD="$(smtp DJANGO_EMAIL_HOST_PASSWORD)"
SMTP_FROM="$(smtp DJANGO_EMAIL_FROM)"
export SMTP_PORT SMTP_USER SMTP_PASSWORD SMTP_FROM

cd ../..
bin/setup-sso-providers.sh
