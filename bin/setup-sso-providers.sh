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

# Development by default; production (deploy/production/bin/setup-keycloak.sh)
# sets these, and COMPOSE_FILE for `docker compose`
ENV_FILE="${SSO_ENV_FILE:-env.d/development/sso.local}"
REALM="${KC_REALM:-impress}"
APP_CLIENT="${KC_APP_CLIENT:-impress}"
PRODUCTION="${PRODUCTION:-}"
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

# Email: Keycloak confirms by email that someone signing in with a second
# provider owns the account it would be linked to. In development, through
# the mail catcher (http://localhost:1081); in production, the SMTP service.
if [[ -n "${SMTP_HOST}" ]]; then
  echo "{\"smtpServer\": {\"host\": \"${SMTP_HOST}\", \"port\": \"${SMTP_PORT:-587}\", \"from\": \"${SMTP_FROM}\", \"fromDisplayName\": \"Collaborators\", \"auth\": \"true\", \"starttls\": \"true\", \"user\": \"${SMTP_USER}\", \"password\": \"${SMTP_PASSWORD}\"}}" \
    | kc update "realms/${REALM}" -f -
  echo "Sent Keycloak's emails through ${SMTP_HOST}"
elif [[ -n "${PRODUCTION}" ]]; then
  # No mail catcher in production: Microsoft sign-ins wait for the SMTP
  # values in env/app.env (their emails must be confirmed by a link)
  echo "No email service yet: fill in the SMTP values of env/app.env, then run this again"
else
  kc update "realms/${REALM}" \
    -s smtpServer.host=mailcatcher \
    -s smtpServer.port=1025 \
    -s smtpServer.from=noreply@collaborators.community \
    -s smtpServer.fromDisplayName=Collaborators
  echo "Sent Keycloak's emails to the dev mail catcher"
fi

# An email nobody has checked (Microsoft) is confirmed by a link before
# entering. Google and LinkedIn emails are trusted as verified (trustEmail),
# so their users are never asked.
kc update "realms/${REALM}" -s verifyEmail=true
echo "Asked unverified emails to be confirmed by a link"

# Signing out of the app also ends the Keycloak session, then comes back to
# the app ("+": the client's redirect addresses). Without it, the next
# sign-in gets the previous account back, whichever provider is chosen.
APP_CLIENT_ID="$(kc get clients -r "${REALM}" -q clientId="${APP_CLIENT}" --fields id --format csv --noquotes)"
kc update "clients/${APP_CLIENT_ID}" -r "${REALM}" \
  -s 'attributes."post.logout.redirect.uris"=+'
echo "Let signing out of the app end the Keycloak session"

# The built-in dev and test accounts (docker/auth/realm.json) have known
# emails: they never need to confirm them (production has none)
if [[ -z "${PRODUCTION}" ]]; then
  for username in impress user-e2e-chromium user-e2e-webkit user-e2e-firefox; do
    user_id="$(kc get users -r "${REALM}" -q "username=${username}" -q exact=true --fields id --format csv --noquotes || true)"
    if [[ -n "${user_id}" ]]; then
      kc update "users/${user_id}" -r "${REALM}" -s emailVerified=true
    fi
  done
  echo "Marked the dev and test accounts' emails as verified"
fi

# The in-app "Sign-in methods" page: connecting a provider goes through
# Keycloak's "idp_link" action, which the app starts at sign-in
if ! kc get authentication/required-actions/idp_link -r "${REALM}" >/dev/null 2>&1; then
  kc create authentication/register-required-action -r "${REALM}" \
    -s providerId=idp_link -s name="Link identity provider"
fi
kc update authentication/required-actions/idp_link -r "${REALM}" -s enabled=true
# Connecting needs a sign-in from the last hour (Keycloak's default is five
# minutes); past that, Keycloak asks to sign in again with a method one has
kc update authentication/required-actions/idp_link/config -r "${REALM}" \
  -b '{"config":{"max_auth_age":"3600"}}'
echo "Let the app connect another provider to an account (idp_link)"

# ...and the backend lists and removes a user's providers through a service
# client of its own (dev secret, also in env.d/development/common)
BACKEND_CLIENT="collaborators-backend"
if [[ -z "$(kc get clients -r "${REALM}" -q clientId="${BACKEND_CLIENT}" --fields id --format csv --noquotes)" ]]; then
  kc create clients -r "${REALM}" \
    -s clientId="${BACKEND_CLIENT}" \
    -s enabled=true \
    -s publicClient=false \
    -s serviceAccountsEnabled=true \
    -s standardFlowEnabled=false \
    -s directAccessGrantsEnabled=false \
    -s secret="${KEYCLOAK_BACKEND_SECRET:-collaborators-backend-dev-secret}"
fi
kc add-roles -r "${REALM}" --uusername "service-account-${BACKEND_CLIENT}" \
  --cclientid realm-management --rolename view-users --rolename manage-users
echo "Let the backend read and remove the providers of an account (${BACKEND_CLIENT})"

# Joining by organisation: Keycloak keeps the Google and Microsoft tokens of
# each sign-in (storeToken, below), and everyone may read their own, which
# the backend does at sign-in with the person's access token for the Google
# Workspace domain ("hd") or Microsoft tenant ("tid") in them
kc add-roles -r "${REALM}" --rname "default-roles-${REALM}" \
  --cclientid broker --rolename read-token
echo "Let everyone read the provider tokens of their own sign-ins"

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

# Google and Microsoft always show their account chooser ("prompt":
# "select_account"): someone with several accounts picks which one, which
# is also how another one is added on the sign-in methods page
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
  "storeToken": true,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": "${GOOGLE_CLIENT_ID}",
    "clientSecret": "${GOOGLE_CLIENT_SECRET}",
    "defaultScope": "openid profile email",
    "prompt": "select_account",
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
  "storeToken": true,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": "${MICROSOFT_CLIENT_ID}",
    "clientSecret": "${MICROSOFT_CLIENT_SECRET}",
    "tenantId": "${MICROSOFT_TENANT_ID:-common}",
    "defaultScope": "openid profile email User.Read",
    "prompt": "select_account",
    "syncMode": "IMPORT",
    "guiOrder": "2"
  }
}
EOF
)"
else
  echo "MICROSOFT_CLIENT_ID is empty: skipping Microsoft"
fi

if [[ -n "${LINKEDIN_CLIENT_ID}" ]]; then
  # "Sign In with LinkedIn using OpenID Connect" returns verified emails
  upsert_provider linkedin "$(cat <<EOF
{
  "alias": "linkedin",
  "displayName": "LinkedIn",
  "providerId": "linkedin-openid-connect",
  "enabled": true,
  "trustEmail": true,
  "firstBrokerLoginFlowAlias": "first broker login",
  "config": {
    "clientId": "${LINKEDIN_CLIENT_ID}",
    "clientSecret": "${LINKEDIN_CLIENT_SECRET}",
    "defaultScope": "openid profile email",
    "syncMode": "IMPORT",
    "guiOrder": "4"
  }
}
EOF
)"
else
  echo "LINKEDIN_CLIENT_ID is empty: skipping LinkedIn"
fi

# Tell the app which providers to offer on its sign-in page, in this order
PROVIDERS="$(kc get identity-provider/instances -r "${REALM}" | python3 -c '
import json, sys
order = ["google", "microsoft", "linkedin"]
enabled = {p["alias"] for p in json.load(sys.stdin) if p.get("enabled")}
print(",".join(alias for alias in order if alias in enabled))
')"
if [[ -n "${PRODUCTION}" ]]; then
  echo "Providers offered: ${PROVIDERS:-none} (COLLABORATORS_SIGNIN_PROVIDERS in env/app.env)"
  exit 0
fi
LOCAL_ENV="env.d/development/common.local"
touch "${LOCAL_ENV}"
grep -v '^COLLABORATORS_SIGNIN_PROVIDERS=' "${LOCAL_ENV}" > "${LOCAL_ENV}.tmp" || true
echo "COLLABORATORS_SIGNIN_PROVIDERS=${PROVIDERS}" >> "${LOCAL_ENV}.tmp"
mv "${LOCAL_ENV}.tmp" "${LOCAL_ENV}"
echo "Sign-in page providers: ${PROVIDERS:-none}. Restart the backend to apply: docker compose up -d app-dev"
