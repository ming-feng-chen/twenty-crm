#!/usr/bin/env bash
# Copies the production database and files from Railway onto the Oracle VM.
# Run from the repo root on the owner's PC (Railway CLI logged in):
#   bash packages/twenty-docker/airpal-oracle/copy-from-railway.sh db|files
set -euo pipefail

VM=${VM:-ubuntu@132.145.30.255}
KEY=${KEY:-$HOME/.ssh/oracle_airpal}
RAILWAY_KEY=${RAILWAY_KEY:-$HOME/.ssh/railway_airpal}
vm() { ssh -i "$KEY" -o BatchMode=yes "$VM" "$@"; }

copy_db() {
  local stamp dump
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  dump=/opt/airpal/restore/railway-$stamp.dump
  vm 'mkdir -p /opt/airpal/restore'
  # Dump inside the Postgres service so it still works while server and worker are stopped.
  railway ssh -i "$RAILWAY_KEY" --service Postgres -- sh -c 'pg_dump -Fc --no-owner --no-acl -U "$PGUSER" -d "$PGDATABASE" | base64 -w0' \
    | vm "base64 -d --ignore-garbage > $dump"
  vm "ls -la $dump && docker run --rm -v /opt/airpal/restore:/restore postgres:18 pg_restore -l /restore/$(basename "$dump") | grep -c 'TABLE DATA'"
  echo "Database copied to $dump"
}

copy_files() {
  railway variables --service server --json | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const v = JSON.parse(s);
      const env = {
        RCLONE_CONFIG_RAILWAY_TYPE: "s3",
        RCLONE_CONFIG_RAILWAY_PROVIDER: "Other",
        RCLONE_CONFIG_RAILWAY_ENDPOINT: v.STORAGE_S3_ENDPOINT,
        RCLONE_CONFIG_RAILWAY_REGION: v.STORAGE_S3_REGION,
        RCLONE_CONFIG_RAILWAY_ACCESS_KEY_ID: v.STORAGE_S3_ACCESS_KEY_ID,
        RCLONE_CONFIG_RAILWAY_SECRET_ACCESS_KEY: v.STORAGE_S3_SECRET_ACCESS_KEY,
        BUCKET: v.STORAGE_S3_NAME,
      };
      for (const [key, value] of Object.entries(env)) console.log(`export ${key}=${JSON.stringify(value)}`);
    });' \
    | vm 'umask 077; cat > /tmp/railway-bucket.env
      . /tmp/railway-bucket.env; rm /tmp/railway-bucket.env
      docker volume inspect airpal_storage >/dev/null 2>&1 || docker volume create \
        --label com.docker.compose.project=airpal --label com.docker.compose.volume=storage airpal_storage >/dev/null
      target=$(docker volume inspect -f "{{.Mountpoint}}" airpal_storage)
      sudo -E rclone sync "railway:$BUCKET" "$target" --exclude "db-backups/**" --stats-one-line --stats 30s
      sudo chown -R 1000:1000 "$target"
      mkdir -p /opt/airpal/restore/railway-db-backups
      rclone copy "railway:$BUCKET/db-backups" /opt/airpal/restore/railway-db-backups
      echo "Files: $(sudo find "$target" -type f | wc -l), $(sudo du -sh "$target" | cut -f1)"
      echo "Railway nightly backups kept: $(ls /opt/airpal/restore/railway-db-backups | wc -l)"'
}

case "${1:-}" in
  db) copy_db ;;
  files) copy_files ;;
  *) echo "usage: $0 db|files" >&2; exit 1 ;;
esac
