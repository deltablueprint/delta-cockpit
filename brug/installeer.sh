#!/usr/bin/env bash
#
# De brugmachine inrichten: IB Gateway, IBC en de brug, op een verse Ubuntu.
#
# Draaien als root op een nieuwe VPS (Ubuntu 24.04, Frankfurt of Amsterdam):
#
#   bash installeer.sh
#
# Wat het doet, in deze volgorde:
#   1. de machine dichttimmeren (alleen SSH naar binnen)
#   2. een gebruiker 'delta' zonder rootrechten
#   3. Node, Java en Xvfb
#   4. IB Gateway en IBC
#   5. de brug, als dienst die vanzelf herstart
#
# Wat het NIET doet: je IBKR-gegevens invoeren. Die zet jij er zelf in, in
# twee bestanden die alleen voor 'delta' leesbaar zijn. Ik vraag je nooit om
# een wachtwoord of een token.

set -euo pipefail
GEBRUIKER=delta
THUIS=/home/$GEBRUIKER

zeg() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Draai dit als root."; exit 1; }

zeg "1 · de deur op slot"
apt-get update -qq
apt-get install -y -qq ufw unzip curl ca-certificates openjdk-17-jre-headless xvfb >/dev/null
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw --force enable >/dev/null
# Wachtwoordaanmelding uit: alleen sleutels. Zorg dat je sleutel werkt vóór je
# deze machine verlaat.
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl reload ssh || systemctl reload sshd || true

zeg "2 · gebruiker $GEBRUIKER"
id -u $GEBRUIKER >/dev/null 2>&1 || adduser --disabled-password --gecos "" $GEBRUIKER
mkdir -p $THUIS/.ssh && cp -n /root/.ssh/authorized_keys $THUIS/.ssh/ 2>/dev/null || true
chown -R $GEBRUIKER:$GEBRUIKER $THUIS/.ssh && chmod 700 $THUIS/.ssh

zeg "3 · Node 22"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
apt-get install -y -qq nodejs >/dev/null
node --version

zeg "4 · IB Gateway"
# De stabiele standalone-versie voor Linux. IBKR vernieuwt deze link zelf, dus
# hij wijst altijd naar de huidige stabiele uitgave.
sudo -u $GEBRUIKER bash -c "cd $THUIS && curl -fsSL -o ibgateway.sh \
  https://download2.interactivebrokers.com/installers/ibgateway/stable-standalone/ibgateway-stable-standalone-linux-x64.sh && chmod +x ibgateway.sh"
echo "   IB Gateway is binnengehaald. De installatie vraagt om een paar keer Enter:"
echo "   sudo -u $GEBRUIKER $THUIS/ibgateway.sh"

zeg "5 · IBC"
IBC_URL=$(curl -fsSL https://api.github.com/repos/IbcAlpha/IBC/releases/latest \
  | grep -o 'https://[^"]*IBCLinux[^"]*\.zip' | head -1)
[ -n "$IBC_URL" ] || { echo "Kon IBC niet vinden; haal hem met de hand van github.com/IbcAlpha/IBC/releases"; exit 1; }
mkdir -p /opt/ibc && cd /opt/ibc
curl -fsSL -o ibc.zip "$IBC_URL" && unzip -oq ibc.zip && rm ibc.zip
# a+x, niet o+x: delta wordt de eigenaar van deze bestanden, en voor de
# eigenaar telt het eigenaarsrecht — niet dat van 'overige gebruikers'.
chmod a+x /opt/ibc/*.sh /opt/ibc/scripts/*.sh
chown -R $GEBRUIKER:$GEBRUIKER /opt/ibc
echo "   IBC geïnstalleerd uit $IBC_URL"

zeg "6 · de twee bestanden die jij invult"
sudo -u $GEBRUIKER bash -c "cat > $THUIS/.delta-brug.env <<'EOF'
COCKPIT_URL=https://delta-cockpit-staging.dejonghe-simon.workers.dev
BRUG_SLEUTEL=VUL-HIER-DEZELFDE-SLEUTEL-IN-ALS-BIJ-CLOUDFLARE
IB_HOST=127.0.0.1
IB_PORT=7497
IB_CLIENT_ID=17
EOF
chmod 600 $THUIS/.delta-brug.env"
cp /opt/ibc/config.ini $THUIS/ibc-config.ini

# Een CR aan het eind van een regel (Windows-regeleinde) telt mee als teken in
# IbLoginId en IbPassword; IBKR antwoordt dan met "invalid username or password"
# en je zoekt je blind. Dit script haalt ze weg bij elke start en weigert te
# starten zolang de inloggegevens nog op de sjabloonwaarden staan.
cat > /usr/local/bin/delta-ibc-schoon <<SCHOON
#!/bin/sh
CFG=$THUIS/ibc-config.ini
sed -i 's/\r\$//' "\$CFG"
naam=\$(sed -n 's/^IbLoginId=//p' "\$CFG" | head -1)
wachtwoord=\$(sed -n 's/^IbPassword=//p' "\$CFG" | head -1)
case "\$naam" in ''|edemo) echo "IbLoginId staat nog op '\$naam' in \$CFG" >&2; exit 1;; esac
case "\$wachtwoord" in ''|demouser) echo "IbPassword is niet ingevuld in \$CFG" >&2; exit 1;; esac
exit 0
SCHOON
chmod a+x /usr/local/bin/delta-ibc-schoon
chown $GEBRUIKER:$GEBRUIKER $THUIS/ibc-config.ini && chmod 600 $THUIS/ibc-config.ini
echo "   $THUIS/.delta-brug.env   — de sleutel naar de cockpit"
echo "   $THUIS/ibc-config.ini    — IbLoginId, IbPassword, TradingMode=paper,"
echo "                              ReadOnlyApi=no, OverrideTwsApiPort=7497"
echo "   Read-only staat uit: met read-only aan komt orderinformatie niet door,"
echo "   en zonder fill-prijs kan een tranche niet gepubliceerd worden."

zeg "7 · de diensten"
cat > /etc/systemd/system/xvfb.service <<'EOF'
[Unit]
Description=Virtueel scherm voor IB Gateway

[Service]
ExecStart=/usr/bin/Xvfb :1 -screen 0 1920x1080x24
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# IB Gateway start via ibcstart.sh en niet via gatewaystart.sh: dan staan het
# versienummer en de paden hier, en niet in een bestand van IBC dat bij elke
# nieuwe uitgave overschreven wordt. Het versienummer komt uit de installatie —
# zie VERSIE hierboven.
VERSIE=$(ls -1 $THUIS/Jts 2>/dev/null | grep -E '^[0-9]+$' | sort -n | tail -1)
VERSIE=${VERSIE:-1050}
cat > /etc/systemd/system/ibgateway.service <<EOF
[Unit]
Description=IB Gateway via IBC
After=network-online.target xvfb.service
Requires=xvfb.service

[Service]
User=$GEBRUIKER
Environment=DISPLAY=:1
ExecStartPre=/usr/local/bin/delta-ibc-schoon
ExecStart=/opt/ibc/scripts/ibcstart.sh $VERSIE --gateway \\
  --mode=paper \\
  --tws-path=$THUIS/Jts \\
  --tws-settings-path=$THUIS/Jts \\
  --ibc-path=/opt/ibc \\
  --ibc-ini=$THUIS/ibc-config.ini
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/delta-brug.service <<EOF
[Unit]
Description=Delta Blueprint — de brug naar de cockpit
After=ibgateway.service

[Service]
User=$GEBRUIKER
WorkingDirectory=$THUIS/brug
ExecStart=/usr/bin/node $THUIS/brug/brug.mjs
Restart=always
RestartSec=10
StandardOutput=append:/var/log/delta-brug.log
StandardError=append:/var/log/delta-brug.log

[Install]
WantedBy=multi-user.target
EOF
touch /var/log/delta-brug.log && chown $GEBRUIKER:$GEBRUIKER /var/log/delta-brug.log
systemctl daemon-reload
systemctl enable --now xvfb

zeg "klaar met het automatische deel"
cat <<EOF

Wat jij nog doet, in deze volgorde:

  1. IB Gateway installeren:   sudo -u $GEBRUIKER $THUIS/ibgateway.sh
     (zeg 'n' op de vraag of hij gestart moet worden — IBC doet dat)
     Kijk daarna welke versie het werd:  ls $THUIS/Jts
     Staat daar iets anders dan $VERSIE, pas dat nummer dan aan in
     /etc/systemd/system/ibgateway.service en draai 'systemctl daemon-reload'.
  2. $THUIS/ibc-config.ini invullen (inloggegevens, TradingMode=paper)
  3. $THUIS/.delta-brug.env invullen (BRUG_SLEUTEL)
  4. De brug erheen kopiëren vanaf je Mac:
       scp -r brug/ $GEBRUIKER@<dit-ip>:$THUIS/brug
       ssh $GEBRUIKER@<dit-ip> 'cd ~/brug && npm install'
  5. Aanzetten:
       systemctl enable --now ibgateway delta-brug
       journalctl -u delta-brug -f

De eerste aanmelding vraagt om tweefactor op je telefoon. Daarna herstart IBC
dagelijks vanzelf; alleen na de serverreset op zondag moet je opnieuw een
melding goedkeuren.
EOF
