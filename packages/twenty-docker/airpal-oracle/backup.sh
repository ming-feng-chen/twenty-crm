#!/usr/bin/env bash
# Nightly backup: database dump + uploaded files, kept 14 days locally and
# copied off the VM when an rclone remote named "offsite" is configured.
set -euo pipefail

cd /opt/airpal
stamp=$(date -u +%Y%m%dT%H%M%SZ)
dir=/opt/airpal/backups
mkdir -p "$dir"

docker compose exec -T db pg_dump -U twenty -d twenty -Fc > "$dir/db-$stamp.dump.part"
mv "$dir/db-$stamp.dump.part" "$dir/db-$stamp.dump"

storage=$(docker volume inspect -f '{{.Mountpoint}}' airpal_storage)
sudo tar -czf "$dir/files-$stamp.tar.gz" -C "$storage" .
sudo chown ubuntu:ubuntu "$dir/files-$stamp.tar.gz"

find "$dir" -name 'db-*.dump' -mtime +14 -delete
find "$dir" -name 'files-*.tar.gz' -mtime +14 -delete

if rclone listremotes | grep -q '^offsite:$'; then
  rclone copy "$dir" offsite:airpal-crm-backups --include "*-$stamp.*"
  rclone delete offsite:airpal-crm-backups --min-age 30d
fi

echo "$(date -u +%FT%TZ) backup $stamp ok $(du -sh "$dir/db-$stamp.dump" | cut -f1) db"
