# De brug

Tussen IB Gateway en de cockpit. Luistert, en schrijft nooit.

## Waarom hij bestaat

Het Flex-rapport is rapportage: je vraagt het aan en krijgt een beeld van
minuten tot een dag oud. Voor het vastleggen van wat er gebeurd is, is dat
genoeg. Voor het bewaken van een stoploss niet — en daar draait het exitplan op.

De TWS API is het tegenovergestelde: geen vraag-en-antwoord maar een open
verbinding die aantikt op het moment dat er iets verandert. Deze brug luistert
daarnaar en duwt elke verandering meteen door naar de cockpit.

## Wat hij niet doet

Een order plaatsen, wijzigen of annuleren. In `brug.mjs` staat geen enkele
aanroep die dat kan. De cockpit kan de brug bovendien niet aansturen: het
verkeer gaat één kant op, van hier naar daar. Twee sloten, allebei in wat wij
bouwen — niet in een instelling die iemand ooit per ongeluk omzet.

### Read-only staat uit, en dat is een keuze

IB Gateway kent een derde slot: *Read-Only API*. Dat staat uit, bewust.

Met read-only aan komt orderinformatie niet door. De brug ziet dan wél dat een
positie verdwijnt, maar niet tegen welke prijs. Dat is onverenigbaar met het
voornemen: bij een rol moet de nieuwe tranche met de échte fill-prijs ontstaan
voordat er naar de leden gepubliceerd wordt, en liever publiceer je een minuut
later dan met een geschatte premie.

De afweging is dus: één slot minder bij IBKR, in ruil voor een publicatie die
klopt. Wat overblijft is sterker dan een instelling — in de code bestaat de
aanroep niet.

## De machine

Een kleine VPS in Frankfurt of Amsterdam, Ubuntu 24.04, vijf tot tien euro per
maand. De blokkade die de Flex-webservice tegenhield geldt hier niet: die zat op
IBKR's webkant, en IB Gateway belt zelf naar buiten.

Op die machine staan je brokergegevens. Daarom: geen inkomende poorten behalve
SSH met sleutels, Gateway alleen op localhost, de brug ernaast op dezelfde
machine. `installeer.sh` zet dat zo neer.

## Inrichten

```
scp brug/installeer.sh root@<ip>:/root/
ssh root@<ip> 'bash /root/installeer.sh'
```

Daarna vul jij twee bestanden in — ik vraag je nooit om een wachtwoord of token:

- `~delta/ibc-config.ini` — `IbLoginId`, `IbPassword`, `TradingMode=paper`,
  `ReadOnlyApi`, `OverrideTwsApiPort=7497`
- `~delta/.delta-brug.env` — `BRUG_SLEUTEL`, dezelfde als bij Cloudflare

En de sleutel aan de cockpitkant, op je eigen machine:

```
npx wrangler secret put BRUG_SLEUTEL --env staging
```

## Aanzetten

```
systemctl enable --now ibgateway delta-brug
journalctl -u delta-brug -f
```

De eerste aanmelding vraagt tweefactor op je telefoon. Daarna herstart IBC
dagelijks vanzelf; alleen na de serverreset op zondag moet je opnieuw
goedkeuren.

## Wat je hoort te zien

In het log, binnen een halve minuut:

```
brug start — cockpit https://…, gateway 127.0.0.1:7497
verbonden met IB Gateway op 127.0.0.1:7497
rekening DU1234567
positie OESX 20NOV26 5600 PUT: — → -2
```

En in de cockpit: `GET /api/brug` geeft `live: true` met je posities. Schrijf je
in het paper account een put, dan hoort die regel er binnen een seconde bij te
staan.

## Als het stil wordt

De brug stuurt elke tien seconden een hartslag, ook als er niets gebeurt. Blijft
het meer dan vijfendertig seconden stil, dan zet de cockpit de verbinding op
*weg* en zegt elk scherm dat erbij. Dat is met opzet: stil oude getallen tonen
is erger dan niets tonen.

## Als de Gateway niet aanmeldt

Draai op de server `bash controleer.sh`. Dat zegt in één scherm of de config
klopt, of de diensten lopen, of er iets op 7497 luistert, en zo niet: wat er op
het scherm van de Gateway staat. Een schermafdruk overzetten is daarmee niet
meer nodig.

IBKR antwoordt op drie heel verschillende problemen met dezelfde zin —
*Connection to server failed: Invalid username or password*:

1. **Het wachtwoord is fout.** Een paper account heeft eigen inloggegevens, los
   van het live account. Je zet ze in Client Portal onder *Settings → Account
   Settings → Paper Trading Account*.
2. **Een onzichtbaar teken in `ibc-config.ini`.** Een Windows-regeleinde achter
   `IbPassword=` telt mee als teken. Het script `delta-ibc-schoon` haalt ze nu
   bij elke start weg, en weigert te starten zolang `IbLoginId` of `IbPassword`
   nog op de sjabloonwaarde staat.
3. **Het account is nog niet aangesloten.** Log in op de portal: staat daar
   *Trading access is unavailable for this user*, dan bestaat het account wel
   maar heeft het nog geen handels- en marktdatatoegang. Dan is er niets te
   repareren — wachten tot IBKR het vrijgeeft, en daarna
   `systemctl restart ibgateway`.

Kijk dus altijd eerst in de portal voordat je aan het wachtwoord gaat zitten.
Dat onderscheid kost anders een halve dag.

Het virtuele scherm staat op 1920×1080. Smaller werkt ook, maar dan vallen de
brede foutmeldingen van de Gateway buiten beeld en lees je ze niet terug.
