#!/usr/bin/env bash
# Sets the email service (SMTP) of Collaborators and of its sign-in server,
# the password read from the standard input so that it never shows on screen
# nor in the list of running processes. From your computer:
#
#   read -rs "key?SMTP key: " && printf '%s' "$key" | ssh root@<server> \
#     /opt/collaborators/deploy/production/bin/set-smtp.sh <host> <port> <login>
#
# Then the app sends its emails (registrations…) and Keycloak its own
# (confirming an email by a link, for Microsoft sign-ins).

set -euo pipefail
cd "$(dirname "$0")/.."

USAGE="usage: printf '%s' KEY | bin/set-smtp.sh <host> <port> <login>"
HOST="${1:?${USAGE}}"
PORT="${2:?${USAGE}}"
LOGIN="${3:?${USAGE}}"
PASSWORD="$(cat)"
if [[ -z "${PASSWORD}" ]]; then
  echo "No SMTP key received on the standard input" >&2
  exit 1
fi

# Rewrite the four values in env/app.env (python: any character is fine)
SMTP_HOST="${HOST}" SMTP_PORT="${PORT}" SMTP_LOGIN="${LOGIN}" SMTP_PASSWORD="${PASSWORD}" \
  python3 - <<'EOF'
import os

path = "env/app.env"
values = {
    "DJANGO_EMAIL_HOST": os.environ["SMTP_HOST"],
    "DJANGO_EMAIL_PORT": os.environ["SMTP_PORT"],
    "DJANGO_EMAIL_HOST_USER": os.environ["SMTP_LOGIN"],
    "DJANGO_EMAIL_HOST_PASSWORD": os.environ["SMTP_PASSWORD"],
}
lines = open(path, encoding="utf-8").read().splitlines()
seen = set()
for index, line in enumerate(lines):
    key = line.split("=", 1)[0]
    if key in values:
        lines[index] = f"{key}={values[key]}"
        seen.add(key)
lines += [f"{key}={value}" for key, value in values.items() if key not in seen]
tmp = f"{path}.tmp"
with open(tmp, "w", encoding="utf-8") as file:
    file.write("\n".join(lines) + "\n")
os.chmod(tmp, 0o600)
os.replace(tmp, path)
EOF
echo "Set the email service in env/app.env (${HOST}, ${LOGIN})"

# The app reads its settings at start; Keycloak gets them through its API
docker compose up -d --no-deps --force-recreate backend worker >/dev/null
bin/setup-keycloak.sh 2>&1 | grep -iE "email|error" || true
echo "Done: the app and the sign-in server send their emails through ${HOST}"
