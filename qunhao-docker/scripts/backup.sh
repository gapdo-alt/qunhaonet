#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$ROOT/backups/qunhao-$STAMP.tar.gz"
mkdir -p "$ROOT/backups"

DB="${DATABASE_PATH:-$ROOT/.data/qunhao.db}"
tar -czf "$OUT" -C "$(dirname "$DB")" "$(basename "$DB")" 2>/dev/null || true
echo "Backup saved to $OUT"
echo "MinIO data: use 'docker compose exec minio mc mirror' for full object backup"
