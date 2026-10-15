#!/usr/bin/env bash
# Nightly backup of the CLC database and staff-uploaded images, kept on the
# VPS (Norway) for 14 days. Run by /etc/cron.d/clc-backup (see below).
#
# Off-server copies must also stay in Norway (data-residency requirement) —
# to be added once a Norwegian storage target exists (Gate2Services).
#
# Install (once, as root on the VPS):
#   chmod 700 /opt/cashmere-cluster-portal/ops/db-backup.sh
#   echo '30 1 * * * root /opt/cashmere-cluster-portal/ops/db-backup.sh >> /var/backups/clc/cron.log 2>&1' > /etc/cron.d/clc-backup
#
# Restore the database from a backup (replaces current data):
#   cd /opt/cashmere-cluster-portal
#   docker compose exec -T postgres pg_restore -U postgres -d cashmere_lovers_club --clean --if-exists < /var/backups/clc/db-YYYYMMDD-HHMM.dump
# Restore images:
#   tar -C /var/lib/docker/volumes/cashmere-cluster-portal_api_uploads/_data -xzf /var/backups/clc/uploads-YYYYMMDD-HHMM.tar.gz
set -euo pipefail

APP_DIR=/opt/cashmere-cluster-portal
DEST=/var/backups/clc
UPLOADS=/var/lib/docker/volumes/cashmere-cluster-portal_api_uploads/_data
KEEP_DAYS=14
STAMP=$(date -u +%Y%m%d-%H%M)

umask 077
mkdir -p "$DEST"
cd "$APP_DIR"

# Database: custom-format dump, checked readable before it's kept.
docker compose exec -T postgres pg_dump -U postgres -Fc cashmere_lovers_club > "$DEST/db-$STAMP.dump.tmp"
docker compose exec -T postgres pg_restore --list < "$DEST/db-$STAMP.dump.tmp" > /dev/null
mv "$DEST/db-$STAMP.dump.tmp" "$DEST/db-$STAMP.dump"

# Uploaded images.
tar -C "$UPLOADS" -czf "$DEST/uploads-$STAMP.tar.gz.tmp" .
mv "$DEST/uploads-$STAMP.tar.gz.tmp" "$DEST/uploads-$STAMP.tar.gz"

# Keep the last 14 days; clear any half-written files from a failed run.
find "$DEST" -maxdepth 1 \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
find "$DEST" -maxdepth 1 -name '*.tmp' -mmin +60 -delete

echo "$(date -u +%FT%TZ) ok db=$(du -h "$DEST/db-$STAMP.dump" | cut -f1) uploads=$(du -h "$DEST/uploads-$STAMP.tar.gz" | cut -f1)" >> "$DEST/backup.log"
