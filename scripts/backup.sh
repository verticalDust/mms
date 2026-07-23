#!/usr/bin/env bash
# Nightly SQLite backup with 14-day retention (E0-S6). Runs on the VPS host via
# cron. A hot `.backup` is WAL-safe while the app keeps the file open.
set -euo pipefail

DB="${DB:-/opt/mms/data/mms.db}"
DEST="${DEST:-/opt/mms/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

mkdir -p "$DEST"
STAMP="$(date +%F)"
OUT="$DEST/mms-$STAMP.db"

sqlite3 "$DB" ".backup '$OUT'"
find "$DEST" -name 'mms-*.db' -mtime "+$RETAIN_DAYS" -delete

echo "backup ok: $OUT ($(du -h "$OUT" | cut -f1))"
