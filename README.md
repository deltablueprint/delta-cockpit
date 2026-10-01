# Delta Blueprint Cockpit

Metadata-gedreven applicatie voor het voeren van naked-put cycli op OESX.
De bron van waarheid voor wat er gebouwd wordt is **BOUWSPEC.md**.

## Mapstructuur

| Map | Wat |
| --- | --- |
| `worker/` | De Cloudflare Worker: API en datalaag |
| `migrations/` | SQL-migraties voor D1, genummerd, nooit achteraf gewijzigd |
| `app/` | De front-end (Vite) — komt in etappe 1 |
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

npm run dev                  # lokaal draaien
npm run db:migrate:local     # migraties lokaal toepassen

npm run db:migrate           # migraties op productie
npm run deploy               # uitrollen naar productie

npm run db:migrate:staging   # migraties op staging
npm run deploy:staging       # uitrollen naar staging
```

## Controle na een uitrol

`GET /api/gezondheid` geeft de omgeving en de schemaversie terug.
Zegt dat veld `schema versie 1`, dan staan de worker en de database goed.

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

## Regels bij het bouwen

- Niets wordt verwijderd: geen DELETE-route, records krijgen een archiefstatus.
- Het systeem plaatst nooit zelf een order; de brokerkoppeling leest alleen.
- Configuratie staat in de database, niet in de code.
- Elke wijziging die afwijkt van BOUWSPEC.md wordt eerst daar vastgelegd.
