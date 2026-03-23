#!/bin/sh
# Pings Supabase every 3 days to prevent free-tier auto-pause (7-day inactivity limit).
# Runs a lightweight SELECT query via the REST API using the anon key.

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') ERROR: Missing SUPABASE_URL or ANON_KEY"
  exit 1
fi

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${SUPABASE_URL}/rest/v1/locations?select=id&limit=1" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

if [ "$RESPONSE" = "200" ]; then
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') OK: Supabase keep-alive ping (HTTP ${RESPONSE})"
else
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') WARN: Supabase returned HTTP ${RESPONSE}"
fi
