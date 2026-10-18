#!/usr/bin/env bash

# Configure the social sign-in providers of the development Keycloak.
#
# Collaborators accounts are created only by signing in through a provider
# (Google, Microsoft, ...): Keycloak brokers those providers and Django keeps
# talking to Keycloak alone, as it already does.
#
# Credentials are read from "env.d/development/sso.local" (gitignored, see
# "env.d/development/sso.local.dist"). A provider whose client id is empty is
# skipped, so Google and Microsoft can be set up one at a time.
#
# Also brands the sign-in page with the Collaborators wordmark and turns off
# Keycloak's own "Register" form: sign-up goes through the providers only. The
# dev users of the realm (impress/impress, the e2e users) keep signing in with
# their password. This part runs even before any provider is configured.
#
# Development only. Idempotent: run it again after changing a credential.

set -eo pipefail

ENV_FILE="env.d/development/sso.local"
REALM="impress"
KCADM="/opt/keycloak/bin/kcadm.sh"
KC_CONFIG="/tmp/kcadm.config"

kc() {
  docker compose exec -T keycloak "${KCADM}" "$@" --config "${KC_CONFIG}"
}

kc config credentials --server http://localhost:8080 --realm master \
  --user "${KEYCLOAK_ADMIN:-admin}" --password "${KEYCLOAK_ADMIN_PASSWORD:-admin}"

kc update "realms/${REALM}" \
  -s registrationAllowed=false \
  -s displayName=Collaborators \
  -s 'displayNameHtml=<b><i>CO</i>✍️✍️<i>ABORATORS</i></b>'
echo "Branded the sign-in page and turned off self-registration by password"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "No ${ENV_FILE} yet: copy ${ENV_FILE}.dist and fill in the client ids and secrets to add the providers." >&2
  exit 0
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

# Create the provider, or update it when it already exists. The JSON goes
# through stdin so the secret never shows on a command line.
upsert_provider() {
  local alias="$1" json="$2"
  if kc get "identity-provider/instances/${alias}" -r "${REALM}" >/dev/null 2>&1; then
    echo "${json}" | kc update "identity-provider/instances/${alias}" -r "${REALM}" -f -
    echo "Updated the ${alias} provider"
  else
    echo "${json}" | kc create identity-provider/instances -r "${REALM}" -f -
    echo "Created the ${alias} provider"
  fi
}

if [[ -n "${GOOGLE_CLIENT_ID}" ]]; then
  # Google verifies the email addresses it returns, so they can be trusted
  # for linking a second sign-in method to an existing account.
  upsert_provider google "$(cat <<EOF
{
  "alias": "google",
  "displayName": "Google",
  "providerId": "google",
  "enabled": true,
  "trustEmail": true,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": "${GOOGLE_CLIENT_ID}",
    "clientSecret": "${GOOGLE_CLIENT_SECRET}",
    "defaultScope": "openid profile email",
    "syncMode": "IMPORT",
    "guiOrder": "1"
  }
}
EOF
)"
else
  echo "GOOGLE_CLIENT_ID is empty: skipping Google"
fi

if [[ -n "${MICROSOFT_CLIENT_ID}" ]]; then
  # "common" accepts both personal Microsoft accounts and work or school
  # accounts. The email of a work account is set by its organisation and is
  # not verified by Microsoft, so it is not trusted for account linking.
  upsert_provider microsoft "$(cat <<EOF
{
  "alias": "microsoft",
  "displayName": "Microsoft",
  "providerId": "microsoft",
  "enabled": true,
  "trustEmail": false,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": "${MICROSOFT_CLIENT_ID}",
    "clientSecret": "${MICROSOFT_CLIENT_SECRET}",
    "tenantId": "${MICROSOFT_TENANT_ID:-common}",
    "defaultScope": "openid profile email User.Read",
    "syncMode": "IMPORT",
    "guiOrder": "2"
  }
}
EOF
)"
else
  echo "MICROSOFT_CLIENT_ID is empty: skipping Microsoft"
fi
