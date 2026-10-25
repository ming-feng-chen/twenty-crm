#!/usr/bin/env bash
# Replaces the VM's database with a dump and (re)starts the CRM.
# Usage: restore.sh <dump-file> <domain> [--no-worker]
set -euo pipefail

dump=$1
domain=$2
cd /opt/airpal

docker compose stop server worker caddy 2>/dev/null || true
docker compose up -d db redis
until docker compose exec -T db pg_isready -U twenty -d twenty >/dev/null 2>&1; do sleep 2; done

docker compose exec -T db psql -U twenty -d postgres -v ON_ERROR_STOP=1 \
  -c 'DROP DATABASE IF EXISTS twenty WITH (FORCE)' -c 'CREATE DATABASE twenty OWNER twenty'
docker compose exec -T db pg_restore -U twenty -d twenty --no-owner --no-acl --exit-on-error < "$dump"
docker compose exec -T redis redis-cli FLUSHALL > /dev/null

sed -i "s/^CRM_DOMAIN=.*/CRM_DOMAIN=$domain/" .env

if [ "${3:-}" = "--no-worker" ]; then
  docker compose up -d server caddy
else
  docker compose up -d
fi
echo "Restored $(basename "$dump") for https://$domain"
