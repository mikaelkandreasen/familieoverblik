#!/bin/sh
# EKSPERIMENT: henter billeder fra en Frameo-ramme over netværket (ADB) og lægger dem i billedmappen,
# så pauseskærmen kan vise dem. Frameos app sender billederne end-to-end-krypteret til rammen, så
# serveren kan ikke hente dem andre steder fra. Rammen har dem dog i åben form, for ellers kunne
# den ikke vise dem. Hvor de ligger, varierer med model og firmware; find mappen først (se LOKAL-GUIDE.md).
#
# Kræver miljøvariablerne FRAMEO_IP=192.168.1.60 og FRAMEO_STI=/sdcard/Frameo (sat på stakken i Dockhand). Billederne lægges i /data/billeder.
# og at ADB er slået til på rammen (Frameo-indstillinger → Om → Beta-program → ADB-adgang).
# Kører som profil, så den ikke starter af sig selv:  docker compose --profile frameo up -d frameo

[ -n "$FRAMEO_IP" ] || { echo "FRAMEO_IP er tom (sæt den på stakken i Dockhand)"; sleep 3600; exit 1; }
STI="${FRAMEO_STI:-/sdcard/Frameo}"
MAAL="${FRAMEO_MAAL:-/data/billeder}"
MIN="${FRAMEO_MINUTTER:-30}"

while true; do
  adb connect "$FRAMEO_IP:5555" >/dev/null 2>&1
  tmp=$(mktemp -d)
  if adb -s "$FRAMEO_IP:5555" pull "$STI" "$tmp" >/dev/null 2>&1; then
    nye=0
    find "$tmp" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) | while read -r f; do
      navn="frameo-$(printf '%s' "$(basename "$f")" | tr -c '[:alnum:]._-' '_')"
      if [ ! -e "$MAAL/$navn" ]; then cp "$f" "$MAAL/$navn"; echo "ny: $navn"; fi
    done
    echo "$(date '+%F %T'): hentet fra $STI på rammen"
  else
    echo "$(date '+%F %T'): kunne ikke hente $STI fra $FRAMEO_IP. Er ADB slået til, og er stien rigtig?"
  fi
  rm -rf "$tmp"
  sleep $((MIN * 60))
done
