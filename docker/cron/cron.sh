#!/bin/sh
# Henter vejr, kalendere, tegneserie m.m. hver time (hent.php). Nøglen står i instans.json, som webcontaineren laver.
INSTANS="${INSTANS:-/data/private/instans.json}"
sleep "${CRON_START:-15}"
while true; do
  if [ -f "$INSTANS" ]; then
    KEY=$(sed -n 's/.*"cron": *"\([A-Za-z0-9]*\)".*/\1/p' "$INSTANS" | head -1)
    if [ -n "$KEY" ]; then curl -fsS -H "X-Cron-Key: $KEY" "${WEB:-http://web}/hent.php?job=all" >/dev/null || echo "hent.php fejlede"; else echo "Fandt ingen cron-nøgle i instans.json"; fi
  else
    echo "Venter på, at opsætningen laver instans.json …"
  fi
  [ -n "$CRON_ENKELT" ] && exit 0
  sleep "${CRON_SEKUNDER:-3600}"
done
