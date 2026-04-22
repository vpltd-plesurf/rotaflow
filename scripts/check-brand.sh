#!/usr/bin/env bash
# Fails if the old user-facing brand "RotaFlow" / "Rota Flow" reappears.
# Lowercase `rotaflow` is allowed — it remains in infra (docker paths,
# npm package name, GitHub URLs) until a dedicated infra rename sweep.
set -euo pipefail

PATTERN='RotaFlow|Rota Flow|ROTAFLOW'

# Ripgrep with excluded paths. Keep this list tight.
if command -v rg >/dev/null 2>&1; then
  hits=$(rg --no-messages -e "$PATTERN" \
    --glob '!node_modules' \
    --glob '!.next' \
    --glob '!package-lock.json' \
    --glob '!scripts/check-brand.sh' \
    . || true)
else
  hits=$(grep -rEn "$PATTERN" . \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude=package-lock.json \
    --exclude=check-brand.sh \
    2>/dev/null || true)
fi

if [ -n "$hits" ]; then
  echo "❌  Old brand 'RotaFlow' found. Replace with 'ROKRota':" >&2
  echo "$hits" >&2
  exit 1
fi

echo "✅  Brand check passed — no 'RotaFlow' in user-facing surfaces."
