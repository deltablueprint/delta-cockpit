#!/bin/bash
# Delta Blueprint — één commando dat zegt waar de verbinding staat.
# Draaien op de server als root:  bash /home/delta/controleer.sh
THUIS=${THUIS:-/home/delta}
CFG=$THUIS/ibc-config.ini

zeg() { printf '\n\033[1m%s\033[0m\n' "$1"; }

zeg "1 · de config"
if [ -f "$CFG" ]; then
  crs=$(grep -c $'\r' "$CFG")
  [ "$crs" -gt 0 ] && echo "   LET OP: $crs regels met een Windows-regeleinde — die breken het wachtwoord"
  awk -F= '/^IbLoginId=/{print "   gebruikersnaam: " $2; exit}' "$CFG"
  awk -F= '/^IbPassword=/{print "   wachtwoordlengte: " length($2); exit}' "$CFG"
  grep -E '^(FIX|TradingMode|ReadOnlyApi|OverrideTwsApiPort)=' "$CFG" | sed 's/^/   /'
else
  echo "   ontbreekt: $CFG"
fi

zeg "2 · de diensten"
for d in xvfb ibgateway delta-brug; do
  printf '   %-12s %s\n' "$d" "$(systemctl is-active $d 2>/dev/null)"
done

zeg "3 · luistert de API op 7497?"
if ss -ltn 2>/dev/null | grep -q ':7497'; then
  echo "   ja — de Gateway staat aangemeld"
else
  echo "   nee — hieronder staat wat er op het scherm van de Gateway staat"
  zeg "4 · het scherm van de Gateway"
  if command -v import >/dev/null && command -v tesseract >/dev/null; then
    DISPLAY=:1 import -window root /tmp/gateway-nu.png 2>/dev/null
    tesseract /tmp/gateway-nu.png - 2>/dev/null | sed '/^$/d;s/^/   /'
    echo "   (het plaatje staat in /tmp/gateway-nu.png)"
  else
    echo "   installeer eerst: apt-get install -y imagemagick tesseract-ocr"
  fi
  zeg "5 · de laatste meldingen"
  journalctl -u ibgateway --since '5 minutes ago' --no-pager 2>/dev/null | tail -12 | sed 's/^/   /'
fi
