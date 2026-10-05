-- Demo voor Dispatch. Alleen voor staging; dit is GEEN migratie.
--
--   npx wrangler d1 execute delta-cockpit-staging --remote --env staging --file scripts/demo-dispatch.sql
--
-- Wat je krijgt: één lopende cyclus 'DEMO · dispatch' die in positie staat, met
-- drie tranches die elk in een ander vak van de balk vallen, verse koersen, een
-- vastgestelde barometerstand, en drie kaarten in de kolom links — een opening,
-- een sluiting, en een doorrol (sluiting + opening kort na elkaar, die het
-- systeem als één handeling herkent).
--
-- Opnieuw draaien mag: het ruimt zijn eigen demo eerst op.
-- Opruimen gaat zoals alles hier: archiveren, niet wissen.
--   update cyclus set archief = 1 where label = 'DEMO · dispatch';
--
-- LET OP — de koersen moeten vers zijn (instelling koers_vers_minuten, 20 min).
-- Staat de balk grijs, draai dan alleen het laatste blok onderaan opnieuw.

-- ---------- opruimen van een eerdere demo ----------
delete from positiemeting where positie in (select id from positie where cyclus in
  (select id from cyclus where label = 'DEMO · dispatch'));
delete from barometerstand where cyclus in (select id from cyclus where label = 'DEMO · dispatch');
delete from gebeurtenis   where cyclus in (select id from cyclus where label = 'DEMO · dispatch');
delete from positie       where cyclus in (select id from cyclus where label = 'DEMO · dispatch');
delete from brokerpositie where conid like '9900%';
delete from cyclus        where label = 'DEMO · dispatch';

-- ---------- de cyclus ----------
insert into cyclus (label, status, geopend_op, doelexpiratie, toelichting)
-- Geopend vandaag, zodat hij bovenaan staat: Dispatch toont de laatst geopende
-- lopende cyclus, en er is geen keuzelijst meer om te wisselen. Staat er een
-- andere demo-cyclus in de weg, archiveer die dan.
values ('DEMO · dispatch', 'in positie', date('now'), date('now', '+25 days'),
        'Demo om Dispatch te beoordelen. Niet echt.');

-- ---------- drie tranches in de markt ----------
-- Premie en ask samen bepalen in welk vak de markering valt:
--   5600: ask 52,0 bij premie 38,5  -> tussen waarschuwing en stoploss: onder druk
--   5450: ask 14,5 bij premie 19,0  -> voorbij break-even: aandacht
--   5300: ask  1,5 bij premie 11,0  -> voorbij het winstanker: veilig
insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, conid, inzet_pct, herkomst, wie_volgt)
select id, 1, 'bewaken', 'OESX 30OKT26 5600 PUT', 5600, date('now', '+25 days'), 4, 38.5, '9900001', 22, 'handmatig', 'simon'
  from cyclus where label = 'DEMO · dispatch';
insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, conid, inzet_pct, herkomst, wie_volgt)
select id, 2, 'bewaken', 'OESX 30OKT26 5450 PUT', 5450, date('now', '+25 days'), 2, 19.0, '9900002', 11, 'handmatig', 'jacqueline'
  from cyclus where label = 'DEMO · dispatch';
insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, conid, inzet_pct, herkomst, wie_volgt)
select id, 3, 'bewaken', 'OESX 30OKT26 5300 PUT', 5300, date('now', '+25 days'), 2, 11.0, '9900003', 9, 'handmatig', 'pieter'
  from cyclus where label = 'DEMO · dispatch';

-- Een vierde die al afgelopen is: die hoort grijs in de lijst en telt niet mee
-- voor de barometer.
insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, conid, inzet_pct, herkomst, uitkomst, resultaat_pt)
select id, 4, 'gesloten', 'OESX 18SEP26 5050 PUT', 5050, date('now', '-17 days'), 0, 22.0, '9900004', 8, 'handmatig',
       'waardeloos geexpireerd', 22.0
  from cyclus where label = 'DEMO · dispatch';

-- ---------- de barometerstand die nu vastligt ----------
-- Comfortabel, terwijl de zwakste tranche onder druk staat: dan toont het scherm
-- het voorstel als stippellijn en kun je publiceren uitproberen.
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door)
select id, 4, 'in_positie', 'Demo: stand met de hand gezet.', 'mens', datetime('now', '-2 hours'), 'simon'
  from cyclus where label = 'DEMO · dispatch';

-- ---------- drie kaarten ----------
-- 1. een opening die nog niet gemeld is
insert into gebeurtenis (cyclus, moment, bron, soort, titel, detail, positie, feiten)
select c.id, datetime('now', '-3 hours'), 'ibkr', 'positie_geopend',
       'Positie geopend: ' || p.contract, 'Demo', p.id,
       json_object('contract', p.contract, 'aantal', p.aantal, 'premie', p.ontvangen_premie_pt)
  from cyclus c join positie p on p.cyclus = c.id and p.tranche = 1
 where c.label = 'DEMO · dispatch';

-- 2 en 3. een sluiting met kort daarna een opening: samen één doorrol
insert into gebeurtenis (cyclus, moment, bron, soort, titel, detail, positie, feiten)
select c.id, datetime('now', '-70 minutes'), 'ibkr', 'positie_gesloten',
       'Positie gesloten: ' || p.contract, 'Demo', p.id,
       json_object('contract', p.contract, 'resultaat', p.resultaat_pt)
  from cyclus c join positie p on p.cyclus = c.id and p.tranche = 4
 where c.label = 'DEMO · dispatch';

insert into gebeurtenis (cyclus, moment, bron, soort, titel, detail, positie, feiten)
select c.id, datetime('now', '-66 minutes'), 'ibkr', 'positie_geopend',
       'Positie geopend: ' || p.contract, 'Demo', p.id,
       json_object('contract', p.contract, 'aantal', p.aantal, 'premie', p.ontvangen_premie_pt)
  from cyclus c join positie p on p.cyclus = c.id and p.tranche = 2
 where c.label = 'DEMO · dispatch';

-- ---------- het verloop van de tranches ----------
-- Vijf dagen meting per tranche, zodat de lijnen rechts iets te tonen hebben.
delete from positiemeting where positie in (select id from positie where cyclus in
  (select id from cyclus where label = 'DEMO · dispatch'));

insert into positiemeting (positie, moment, ask, bod, stand, binnen)
select p.id, datetime('now', '-' || (v.n * 6) || ' hours'),
       round(52.0 + (v.n * 1.4) + ((v.n % 3) * 1.1), 1), round(51.0 + (v.n * 1.4), 1),
       case when 52.0 + (v.n * 1.4) > 50 then 1 else 2 end,
       round((38.5 - (52.0 + v.n * 1.4 + (v.n % 3) * 1.1)) / 38.5 * 100, 1)
  from positie p join cyclus c on c.id = p.cyclus
  join (select 0 as n union all select 1 union all select 2 union all select 3
        union all select 4 union all select 5 union all select 6 union all select 7
        union all select 8 union all select 9 union all select 10 union all select 11) v
 where c.label = 'DEMO · dispatch' and p.tranche = 1;

insert into positiemeting (positie, moment, ask, bod, stand, binnen)
select p.id, datetime('now', '-' || (v.n * 6) || ' hours'),
       round(14.5 + (v.n * 0.7) - ((v.n % 4) * 0.5), 1), round(14.0 + (v.n * 0.7), 1), 3,
       round((19.0 - (14.5 + v.n * 0.7 - (v.n % 4) * 0.5)) / 19.0 * 100, 1)
  from positie p join cyclus c on c.id = p.cyclus
  join (select 0 as n union all select 1 union all select 2 union all select 3
        union all select 4 union all select 5 union all select 6 union all select 7
        union all select 8 union all select 9 union all select 10 union all select 11) v
 where c.label = 'DEMO · dispatch' and p.tranche = 2;

insert into positiemeting (positie, moment, ask, bod, stand, binnen)
select p.id, datetime('now', '-' || (v.n * 6) || ' hours'),
       round(1.5 + (v.n * 0.6) + ((v.n % 5) * 0.4), 1), round(1.2 + (v.n * 0.6), 1),
       case when 1.5 + (v.n * 0.6) < 3.3 then 5 else 4 end,
       round((11.0 - (1.5 + v.n * 0.6 + (v.n % 5) * 0.4)) / 11.0 * 100, 1)
  from positie p join cyclus c on c.id = p.cyclus
  join (select 0 as n union all select 1 union all select 2 union all select 3
        union all select 4 union all select 5 union all select 6 union all select 7
        union all select 8 union all select 9 union all select 10 union all select 11) v
 where c.label = 'DEMO · dispatch' and p.tranche = 3;

-- Een paar standwisselingen, zodat de geschiedenis rechts niet leeg is.
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op)
select id, 2, 'opent_binnenkort', 'Demo: het venster gaat open.', 'mens', datetime('now', '-6 days'), 'simon', datetime('now', '-6 days')
  from cyclus where label = 'DEMO · dispatch';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op)
select id, 5, 'in_positie', 'Demo: wij zitten erin.', 'mens', datetime('now', '-4 days'), 'simon', datetime('now', '-4 days')
  from cyclus where label = 'DEMO · dispatch';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door)
select id, 4, 'in_positie', 'Demo: de 5600 liep op.', 'voorstel', datetime('now', '-26 hours'), 'jacqueline'
  from cyclus where label = 'DEMO · dispatch';

-- ---------- de koersen ----------
-- Dit blok mag je los opnieuw draaien zodra de balk grijs wordt: het zet alleen
-- de prijzen en hun tijdstip terug op nu.
delete from brokerpositie where conid like '9900%';
insert into brokerpositie (conid, contract, onderliggend, soort, strike, expiratiedatum, putcall,
                           multiplier, aantal, marktprijs, biedprijs, laatprijs, gewijzigd_op) values
  ('9900001','OESX 30OKT26 5600 PUT','OESX','OPT',5600,date('now','+25 days'),'P',10,-4,51.0,50.0,52.0,datetime('now')),
  ('9900002','OESX 30OKT26 5450 PUT','OESX','OPT',5450,date('now','+25 days'),'P',10,-2,14.0,13.5,14.5,datetime('now')),
  ('9900003','OESX 30OKT26 5300 PUT','OESX','OPT',5300,date('now','+25 days'),'P',10,-2, 1.4, 1.2, 1.5,datetime('now'));
