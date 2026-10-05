#!/usr/bin/env bash
# Multi-user security tests (RLS, RPCs, Storage) against the local Supabase.
# Each SQL file plays several users inside one transaction, rolled back at the end,
# and fails if any check fails. Run from anywhere: bash supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")"

DB_URL=${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}

# psql from the host (CI) or, if missing (e.g. Windows), from the database container.
sql() {
  if command -v psql > /dev/null; then
    psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$1"
  else
    docker exec -i "$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)" psql -U postgres -q -v ON_ERROR_STOP=1 < "$1"
  fi
}

for file in [0-9]*.sql; do
  echo "== $file"
  # Prints only the check lines ("name | t"), the full output on failure.
  if ! output=$(sql "$file" 2>&1); then
    echo "$output"
    exit 1
  fi
  echo "$output" | grep -E '\| [tf]$'
done

echo "== storage_photos.sh"
bash storage_photos.sh
