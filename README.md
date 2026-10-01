# Delta Blueprint Cockpit

Metadata-gedreven applicatie voor het voeren van naked-put cycli op OESX.
De bron van waarheid voor wat er gebouwd wordt is **BOUWSPEC.md**.

## Mapstructuur

| Map | Wat |
| --- | --- |
| `worker/` | De Cloudflare Worker: API en datalaag |
| `migrations/` | SQL-migraties voor D1, genummerd, nooit achteraf gewijzigd |
| `app/` | De front-end: Vite, vanilla JavaScript, vier bouwstenen |
| `dist/` | De gebouwde front-end (niet in git) |
| `docs/` | Achtergronddocumenten |
| `legacy/` | De bestaande Cockpit, draait voorlopig door |

## Omgevingen

| | Worker | Database |
| --- | --- | --- |
| Productie | `delta-cockpit` | `delta-cockpit` |
| Staging | `delta-cockpit-staging` | `delta-cockpit-staging` |

## Commando's

```bash
npm install                  # eenmalig
npx wrangler login           # eenmalig, opent de browser

npm run dev:api              # worker lokaal op :8787
npm run dev:app              # front-end lokaal, stuurt /api door naar de worker
npm run build                # front-end bouwen naar dist/
npm run db:migrate:local     # migraties lokaal toepassen

npm run db:migrate           # migraties op productie
npm run deploy               # uitrollen naar productie

npm run db:migrate:staging   # migraties op staging
npm run deploy:staging       # uitrollen naar staging
```

## Aanmelden

Aanmelden gaat met **e-mailadres en wachtwoord**, per persoon. Het wachtwoord
staat nergens opgeslagen — alleen de SHA-256 hash ervan. Het e-mailadres is de
gebruikersnaam, zodat een wachtwoord gewijzigd kan worden zonder dat de
identiteit verandert.

```bash
node scripts/wachtwoord.mjs 'jouw wachtwoord'     # print de hash
npx wrangler d1 execute delta-cockpit-staging --remote --env staging \
  --command "update gebruiker set wachtwoord_hash='<hash>', wachtwoord_gezet_op=datetime('now') where email='simon@deltablueprint.nl'"
```

Ieder zet zijn eigen wachtwoord, zodat niemand dat van een ander kent.

## Controle na een uitrol

`GET /api/gezondheid` geeft de omgeving en de schemaversie terug — dat eindpunt is open.
Alles onder `/api/` vraagt om een persoon:

```bash
curl -s -u simon@deltablueprint.nl:'jouw wachtwoord' https://delta-cockpit-staging.dejonghe-simon.workers.dev/api/ik
curl -s -u simon@deltablueprint.nl:'jouw wachtwoord' https://delta-cockpit-staging.dejonghe-simon.workers.dev/api/meta
```

## Takken en uitrollen

| Tak | Rolt uit naar | Hoe |
| --- | --- | --- |
| `staging` | `delta-cockpit-staging` | automatisch bij elke push |
| `main` | `delta-cockpit` | automatisch bij elke push |

Werkwijze: wijzigingen gaan eerst naar `staging`, worden daar bekeken, en pas daarna
naar `main` gemerged. Migraties worden met de hand toegepast (`npm run db:migrate:staging`
en `npm run db:migrate`) vóórdat de code die ze nodig heeft wordt uitgerold — een build
voert geen migraties uit.

## Live

| Omgeving | URL |
| --- | --- |
| Productie | https://delta-cockpit.dejonghe-simon.workers.dev |
| Staging | https://delta-cockpit-staging.dejonghe-simon.workers.dev |

## Events importeren

```bash
node scripts/events-naar-sql.mjs mijn-events.csv > events.sql
npx wrangler d1 execute delta-cockpit-staging --remote --env staging --file events.sql
```

Kolommen: `datum,tijdstip,naam,soort,zwaarte,toelichting`.
Zie `scripts/events-voorbeeld.csv`. Events staan los van cycli; de behandeling
binnen een cyclus leg je vast op het tabblad *Events in de looptijd*.

## Regels bij het bouwen

- Niets wordt verwijderd: geen DELETE-route, records krijgen een archiefstatus.
- Het systeem plaatst nooit zelf een order; de brokerkoppeling leest alleen.
- Configuratie staat in de database, niet in de code.
- Elke wijziging die afwijkt van BOUWSPEC.md wordt eerst daar vastgelegd.
