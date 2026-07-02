#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost}"
echo "Smoke test: $BASE"

curl -sf "$BASE/health" | grep -q '"ok"'
echo "✓ health"

curl -sf "$BASE/api/config" | grep -q 'publicHost'
echo "✓ config"

for p in / /intro /login /register /forgot-password; do
  curl -sf -o /dev/null -w "" "$BASE$p"
  echo "✓ GET $p"
done

echo "All smoke checks passed."
