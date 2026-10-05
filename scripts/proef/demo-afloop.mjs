// Zet een demo klaar voor 'Einde van een tranche' — zonder brokerkoppeling.
//
//   node scripts/proef/demo-afloop.mjs > scripts/demo-afloop.sql
//
// Schrijft één SQL-bestand dat je in staging laadt. Daarin: een demo-cyclus met
// drie tranches en het nagemaakte Flex-rapport. Daarna toont het scherm precies
// wat het bij een echt rapport zou tonen — een rol, een vervroegde terugkoop en
// een tranche die doorloopt — en kun je ze echt vastleggen.
//
// Niets wordt gewist en niets bestaands wordt aangeraakt: de cyclus heet
// 'DEMO · einde van een tranche' en is naderhand te archiveren.
import { readFileSync } from "node:fs";

const xml = readFileSync(new URL("./materiaal/afloop.xml", import.meta.url), "utf8");
const veilig = (t) => t.replace(/'/g, "''");

process.stdout.write(`-- Demo voor 'Einde van een tranche'. Laden met:
--   npx wrangler d1 execute delta-cockpit-staging --remote --env staging --file scripts/demo-afloop.sql
--
-- Opruimen gaat zoals alles in deze applicatie: archiveren, niet wissen.
--   update positie set archief = 1 where cyclus = (select id from cyclus where label = 'DEMO · einde van een tranche');
--   update cyclus  set archief = 1 where label = 'DEMO · einde van een tranche';

insert into cyclus (label, status, geopend_op, doelexpiratie, toelichting)
values ('DEMO · einde van een tranche', 'in positie', '2026-09-01', '2026-10-30',
        'Demo met een nagemaakt Flex-rapport. Niet echt.');

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, conid, inzet_pct, herkomst)
select id, 1, 'bewaken', 'OESX 30OKT26 5600 PUT', 5600, '2026-10-30', 2, 38.5, '7000001', 24, 'handmatig'
  from cyclus where label = 'DEMO · einde van een tranche';

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, conid, inzet_pct, herkomst)
select id, 2, 'bewaken', 'OESX 30OKT26 5700 PUT', 5700, '2026-10-30', 1, 44.0, '7000002', 12, 'handmatig'
  from cyclus where label = 'DEMO · einde van een tranche';

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, conid, inzet_pct, herkomst)
select id, 3, 'bewaken', 'OESX 18DEC26 5400 PUT', 5400, '2026-12-18', 1, 52.0, '7000004', 10, 'handmatig'
  from cyclus where label = 'DEMO · einde van een tranche';

-- Een stoploss die geraakt is op tranche 2: dan stelt het systeem daar
-- 'exitplan uitgevoerd' voor in plaats van 'vervroegd teruggekocht'.
insert into exitregel (positie, volgorde, soort, omschrijving, niveau, eenheid, stand, geraakt_op)
select p.id, 10, 'stoploss', 'Sluiten zodra de laatprijs op 60,0 staat', 60, 'ask', 'geraakt', '2026-09-30'
  from positie p join cyclus c on c.id = p.cyclus
 where c.label = 'DEMO · einde van een tranche' and p.tranche = 2;

insert into lynx_rapport (xml, bron, regels, opgehaald_op)
values ('${veilig(xml)}', 'demo', 7, '2026-10-03 09:00:00');
`);
