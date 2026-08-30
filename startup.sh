#!/bin/bash

# Dokku sets DATABASE_URL when a Postgres service is linked to the app, and also sets a
# service-specific DOKKU_POSTGRES_<NAME>_URL. If this app's Postgres service is not the one
# DATABASE_URL points at, set POSTGRES_URL_VAR to the name of the service-specific variable
# (e.g. POSTGRES_URL_VAR=DOKKU_POSTGRES_TAAPPLY_URL) and it will be preferred.
#
# proj-citelines hardcoded DOKKU_POSTGRES_AQUA_URL here; that is its service, not ours, so it
# is configurable rather than baked in. See docs/issues/iteration-1-bootstrap.md.
if [ -n "$POSTGRES_URL_VAR" ] && [ -n "${!POSTGRES_URL_VAR}" ]; then
  DATABASE_URL="${!POSTGRES_URL_VAR}"
fi

if [ -z "$DATABASE_URL" ]; then
  echo "startup.sh: neither DATABASE_URL nor \$POSTGRES_URL_VAR is set; cannot build JDBC settings" >&2
  exit 1
fi

export JDBC_DATABASE_PASSWORD=$(echo "$DATABASE_URL" | cut -d: -f3 | cut -d@ -f1)

export JDBC_DATABASE_URL=jdbc:postgresql://$(echo "$DATABASE_URL" | cut -d@ -f2)

export JDBC_DATABASE_USERNAME=postgres

java -jar $1
