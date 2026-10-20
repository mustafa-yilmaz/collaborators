#!/bin/bash
# The databases of the collaboration server and of Keycloak, next to the
# app's own (POSTGRES_DB), on the first start only.
set -e
for db in yhub keycloak; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -c "CREATE DATABASE $db OWNER \"$POSTGRES_USER\";"
done
