#!/bin/sh
# Aula-synkroniseringen: venter på, at opsætningen har lavet config.py, og kører så Sync-Aula.py hver morgen (standard 07:00, TZ i containeren).
# Første Aula-login sker i containerens terminal (Dockhand): aula --username DIT-MITID-BRUGERNAVN login
CFG="${AULA_CONFIG:-/data/private/aula-config/config.py}"
TID="${AULA_TID:-07:00}"
while true; do
  if [ ! -f "$CFG" ]; then
    echo "Venter på, at opsætningen er gennemført (config.py findes ikke endnu) …"
    [ -n "$LOOP_ENKELT" ] && exit 0
    sleep "${LOOP_VENT:-60}"; continue
  fi
  n=$(date +%s); t=$(date -d "today $TID" +%s)
  [ "$n" -ge "$t" ] && t=$(date -d "tomorrow $TID" +%s)
  sleep $((t - n))
  python /app/Sync-Aula.py || echo "Sync-Aula.py fejlede (se loggen). Er Aula-login udløbet? Log ind i containerens terminal."
  [ -n "$LOOP_ENKELT" ] && exit 0
done
