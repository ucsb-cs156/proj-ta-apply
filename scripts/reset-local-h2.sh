#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_BASE="$ROOT_DIR/target/db-development"
DB_MAIN="$DB_BASE.mv.db"
DB_TRACE="$DB_BASE.trace.db"

cd "$ROOT_DIR"

echo "Stopping existing app process is recommended before reset."

if [[ -f "$DB_MAIN" ]]; then
  rm -f "$DB_MAIN"
  echo "Deleted $DB_MAIN"
else
  echo "No file at $DB_MAIN"
fi

if [[ -f "$DB_TRACE" ]]; then
  rm -f "$DB_TRACE"
  echo "Deleted $DB_TRACE"
else
  echo "No file at $DB_TRACE"
fi

echo "Local H2 database reset complete."

if [[ "${1:-}" == "--run" ]]; then
  echo "Starting app with Maven..."
  exec mvn spring-boot:run
fi

echo "Run the app with: mvn spring-boot:run"
