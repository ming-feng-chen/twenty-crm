#!/usr/bin/env bash
# Points crm.airpal.co.uk at Railway or the Oracle VM through the Wix DNS API.
# Usage: dns.sh show | ttl | oracle | railway
set -euo pipefail

KEY_FILE=${WIX_KEY_FILE:-C:/Users/ming_/Desktop/Workk/AirPal/wix-api-key.txt}
ACCOUNT=84fb35b9-a2f7-4627-8abf-275ff1cc55b6
ZONE=https://www.wixapis.com/domains/v1/dns-zones/airpal.co.uk
HOST=crm.airpal.co.uk
ORACLE_IP=${ORACLE_IP:-132.145.30.255}
RAILWAY_TARGET=g2svfzix.up.railway.app

wix() {
  curl -sS --fail-with-body -H "Authorization: $(tr -d '\r\n' < "$KEY_FILE")" \
    -H "wix-account-id: $ACCOUNT" -H 'Content-Type: application/json' "$@"
}

current() {
  wix "$ZONE" | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const records = JSON.parse(s).dnsZone.records.filter((r) => r.hostName === process.argv[1] && ["A", "CNAME"].includes(r.type));
      console.log(JSON.stringify(records));
    });' "$HOST"
}

replace_with() {
  local addition=$1
  wix -X PATCH "$ZONE" -d "{\"domainName\":\"airpal.co.uk\",\"deletions\":$(current),\"additions\":[$addition]}" > /dev/null
  echo "Now: $(current)"
}

case "${1:-show}" in
  show) current ;;
  ttl) replace_with "{\"type\":\"CNAME\",\"hostName\":\"$HOST\",\"ttl\":600,\"values\":[\"$RAILWAY_TARGET\"]}" ;;
  oracle) replace_with "{\"type\":\"A\",\"hostName\":\"$HOST\",\"ttl\":600,\"values\":[\"$ORACLE_IP\"]}" ;;
  railway) replace_with "{\"type\":\"CNAME\",\"hostName\":\"$HOST\",\"ttl\":600,\"values\":[\"$RAILWAY_TARGET\"]}" ;;
  *) echo "usage: $0 show|ttl|oracle|railway" >&2; exit 1 ;;
esac
