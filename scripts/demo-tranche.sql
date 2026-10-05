-- Demo voor de twee scenario's rond het einde van een tranche.
--
--   npx wrangler d1 execute delta-cockpit-staging --remote --env staging --file scripts/demo-tranche.sql
--
-- Twee cycli, elk met één tranche die in de markt staat. De contractnummers
-- komen overeen met wat scripts/proef/brug-simulatie.mjs stuurt.
--
-- Opruimen gaat zoals alles hier — archiveren, niet wissen:
--   update positie  set archief = 1 where cyclus in (select id from cyclus where label like 'PROEF%');
--   update exitregel set archief = 1 where positie in (select id from positie where cyclus in (select id from cyclus where label like 'PROEF%'));
--   update cyclus   set archief = 1 where label like 'PROEF%';

insert into cyclus (label, status, geopend_op, doelexpiratie, toelichting) values
  ('PROEF A · spiegelen', 'in positie', '2026-09-01', '2026-11-20',
   'De cockpit spiegelt wat er bij Lynx gebeurt. Niets aan te kondigen.'),
  ('PROEF B · tweede cyclus',     'in positie', '2026-09-01', '2026-11-20',
   'Tweede lopende cyclus: daardoor blijft een nieuwe positie onverdeeld staan.');

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, conid, inzet_pct, herkomst)
select id, 1, 'bewaken', 'OESX 30OKT26 5600 PUT', 5600, '2026-10-30', 2, 38.5, '9000001', 24, 'handmatig'
  from cyclus where label = 'PROEF A · spiegelen';

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, conid, inzet_pct, herkomst)
select id, 1, 'bewaken', 'OESX 30OKT26 5700 PUT', 5700, '2026-10-30', 2, 44.0, '9000011', 20, 'handmatig'
  from cyclus where label = 'PROEF B · tweede cyclus';

-- Een exitplan erbij, zodat je ziet dat het van de nieuwe tranche tegen háár
-- premie gerekend wordt.
insert into exitregel (positie, volgorde, soort, omschrijving, niveau, eenheid)
select p.id, 10, 'stoploss', 'Sluiten zodra de laatprijs van de optie op 60,0 staat', 60, 'ask'
  from positie p join cyclus c on c.id = p.cyclus where c.label like 'PROEF%';

insert into exitregel (positie, volgorde, soort, omschrijving, niveau, eenheid)
select p.id, 20, 'winstanker', 'Terugkopen bij 70 % van de ontvangen premie',
       round(p.ontvangen_premie_pt * 0.3, 1), 'ask'
  from positie p join cyclus c on c.id = p.cyclus where c.label like 'PROEF%';
