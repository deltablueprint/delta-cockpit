-- Demo-historie voor de terugblik in Dispatch. Alleen voor staging; GEEN migratie.
--
--   npx wrangler d1 execute delta-cockpit-staging --remote --env staging --file scripts/demo-historie.sql
--
-- Vijf afgesloten cycli van mei tot september 2026, elk met tranches die hun
-- eigen verhaal hebben: een die rustig uitdooft, een die eerst schrikt en
-- daarna wegzakt, en een die door de stoploss gaat. Per handelsdag staat er een
-- meting, zodat de strook vakjes en de balk laten zien hoe het liep. De
-- barometerstanden en de berichten die eruit gingen staan er ook bij.
--
-- Opnieuw draaien mag: het ruimt zijn eigen historie eerst op. Geen temp
-- tables en geen pragma's — D1 weigert die met 'not authorized'.

-- ---------- opruimen ----------
update gebeurtenis    set publicatie = null where publicatie in (select id from publicatie where cyclus in (select id from cyclus where label like 'HISTORIE · %') or positie in (select id from positie where cyclus in (select id from cyclus where label like 'HISTORIE · %')) or gebeurtenis in (select id from gebeurtenis where cyclus in (select id from cyclus where label like 'HISTORIE · %')));
update barometerstand set publicatie = null where publicatie in (select id from publicatie where cyclus in (select id from cyclus where label like 'HISTORIE · %') or positie in (select id from positie where cyclus in (select id from cyclus where label like 'HISTORIE · %')) or gebeurtenis in (select id from gebeurtenis where cyclus in (select id from cyclus where label like 'HISTORIE · %')));
update positie        set doorgerold_naar = null where cyclus in (select id from cyclus where label like 'HISTORIE · %');
delete from publicatie_ontvanger where publicatie in (select id from publicatie where cyclus in (select id from cyclus where label like 'HISTORIE · %') or positie in (select id from positie where cyclus in (select id from cyclus where label like 'HISTORIE · %')) or gebeurtenis in (select id from gebeurtenis where cyclus in (select id from cyclus where label like 'HISTORIE · %')));
delete from publicatie   where cyclus in (select id from cyclus where label like 'HISTORIE · %') or positie in (select id from positie where cyclus in (select id from cyclus where label like 'HISTORIE · %')) or gebeurtenis in (select id from gebeurtenis where cyclus in (select id from cyclus where label like 'HISTORIE · %'));
delete from barometerstand where cyclus in (select id from cyclus where label like 'HISTORIE · %');
delete from gebeurtenis    where cyclus in (select id from cyclus where label like 'HISTORIE · %') or positie in (select id from positie where cyclus in (select id from cyclus where label like 'HISTORIE · %'));
delete from positiemeting  where positie in (select id from positie where cyclus in (select id from cyclus where label like 'HISTORIE · %'));
delete from positievolger  where positie in (select id from positie where cyclus in (select id from cyclus where label like 'HISTORIE · %'));
delete from exitregel      where positie in (select id from positie where cyclus in (select id from cyclus where label like 'HISTORIE · %'));
delete from voornemen      where positie in (select id from positie where cyclus in (select id from cyclus where label like 'HISTORIE · %')) or opvolger in (select id from positie where cyclus in (select id from cyclus where label like 'HISTORIE · %'));
delete from positie        where cyclus in (select id from cyclus where label like 'HISTORIE · %');
delete from voorwaarde         where cyclus in (select id from cyclus where label like 'HISTORIE · %');
delete from chartlezing        where cyclus in (select id from cyclus where label like 'HISTORIE · %');
delete from beoordelingsmoment where cyclus in (select id from cyclus where label like 'HISTORIE · %');
delete from inzending          where cyclus in (select id from cyclus where label like 'HISTORIE · %');
delete from cyclus_event       where cyclus in (select id from cyclus where label like 'HISTORIE · %');
delete from cyclus where label like 'HISTORIE · %';

-- ---------- drie demo-leden, zodat een bericht ontvangers heeft ----------
insert into lid (naam, email, status, aangemeld_op)
  select 'Demo lid 1', 'demo1@delta-historie.test', 'actief', '2026-03-01'
   where not exists (select 1 from lid where email = 'demo1@delta-historie.test');
insert into lid (naam, email, status, aangemeld_op)
  select 'Demo lid 2', 'demo2@delta-historie.test', 'actief', '2026-03-01'
   where not exists (select 1 from lid where email = 'demo2@delta-historie.test');
insert into lid (naam, email, status, aangemeld_op)
  select 'Demo lid 3', 'demo3@delta-historie.test', 'actief', '2026-03-05'
   where not exists (select 1 from lid where email = 'demo3@delta-historie.test');

-- ================= HISTORIE · mei 2026 =================
insert into cyclus (label, status, geopend_op, doelexpiratie, afgesloten_op, toelichting)
values ('HISTORIE · mei 2026', 'afgesloten', '2026-04-20', '2026-05-15', '2026-05-15',
        'Demo-historie. Niet echt.');

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 1, 'gesloten', 'OESX 15MAY26 5000 PUT', 5000, '2026-05-15', 3, 34.0, 20,
       'handmatig', 'waardeloos geexpireerd', 34.0, '2026-04-20', '2026-05-15'
  from cyclus where label = 'HISTORIE · mei 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-04-20 17:30:00', 36.7, 36.3, 2, -8),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-04-21 17:30:00', 33.8, 33.4, 3, 1),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-04-22 17:30:00', 30.9, 30.5, 3, 9),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-04-23 17:30:00', 28.1, 27.7, 3, 17),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-04-24 17:30:00', 25.4, 25.0, 3, 25),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-04-27 17:30:00', 22.9, 22.5, 3, 33),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-04-28 17:30:00', 20.4, 20.0, 3, 40),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-04-29 17:30:00', 18.0, 17.6, 3, 47),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-04-30 17:30:00', 15.8, 15.4, 4, 54),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-05-01 17:30:00', 13.6, 13.2, 4, 60),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-05-04 17:30:00', 11.6, 11.2, 4, 66),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-05-05 17:30:00', 9.7, 9.3, 5, 71),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-05-06 17:30:00', 7.9, 7.5, 5, 77),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-05-07 17:30:00', 6.2, 5.8, 5, 82),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-05-08 17:30:00', 4.7, 4.3, 5, 86),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-05-11 17:30:00', 3.4, 3.0, 5, 90),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-05-12 17:30:00', 2.2, 1.8, 5, 94),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-05-13 17:30:00', 1.2, 0.8, 5, 96),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-05-14 17:30:00', 0.4, 0.1, 5, 99),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 5000 PUT'), '2026-05-15 17:30:00', 0.1, 0.1, 5, 100);

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 2, 'gesloten', 'OESX 15MAY26 4900 PUT', 4900, '2026-05-15', 2, 21.0, 11,
       'handmatig', 'waardeloos geexpireerd', 21.0, '2026-04-22', '2026-05-15'
  from cyclus where label = 'HISTORIE · mei 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-04-22 17:30:00', 22.7, 22.3, 2, -8),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-04-23 17:30:00', 20.6, 20.2, 3, 2),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-04-24 17:30:00', 18.7, 18.3, 3, 11),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-04-27 17:30:00', 16.8, 16.4, 3, 20),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-04-28 17:30:00', 15.0, 14.6, 3, 29),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-04-29 17:30:00', 13.2, 12.8, 3, 37),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-04-30 17:30:00', 11.6, 11.2, 3, 45),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-05-01 17:30:00', 10.0, 9.6, 4, 52),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-05-04 17:30:00', 8.5, 8.1, 4, 60),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-05-05 17:30:00', 7.1, 6.7, 4, 66),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-05-06 17:30:00', 5.8, 5.4, 5, 72),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-05-07 17:30:00', 4.6, 4.2, 5, 78),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-05-08 17:30:00', 3.5, 3.1, 5, 83),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-05-11 17:30:00', 2.5, 2.1, 5, 88),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-05-12 17:30:00', 1.6, 1.2, 5, 92),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-05-13 17:30:00', 0.9, 0.5, 5, 96),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-05-14 17:30:00', 0.3, 0.1, 5, 99),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4900 PUT'), '2026-05-15 17:30:00', 0.1, 0.1, 5, 100);

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 3, 'gesloten', 'OESX 15MAY26 4800 PUT', 4800, '2026-05-15', 2, 13.0, 9,
       'handmatig', 'waardeloos geexpireerd', 13.0, '2026-04-24', '2026-05-15'
  from cyclus where label = 'HISTORIE · mei 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-04-24 17:30:00', 14.0, 13.6, 2, -8),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-04-27 17:30:00', 12.6, 12.2, 3, 3),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-04-28 17:30:00', 11.2, 10.8, 3, 14),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-04-29 17:30:00', 9.9, 9.5, 3, 24),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-04-30 17:30:00', 8.7, 8.3, 3, 33),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-05-01 17:30:00', 7.5, 7.1, 3, 42),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-05-04 17:30:00', 6.4, 6.0, 4, 51),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-05-05 17:30:00', 5.3, 4.9, 4, 59),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-05-06 17:30:00', 4.3, 3.9, 4, 67),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-05-07 17:30:00', 3.4, 3.0, 5, 74),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-05-08 17:30:00', 2.6, 2.2, 5, 80),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-05-11 17:30:00', 1.8, 1.4, 5, 86),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-05-12 17:30:00', 1.2, 0.8, 5, 91),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-05-13 17:30:00', 0.7, 0.3, 5, 95),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-05-14 17:30:00', 0.2, 0.1, 5, 98),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026') and contract = 'OESX 15MAY26 4800 PUT'), '2026-05-15 17:30:00', 0.1, 0.1, 5, 99);

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · mei 2026: De cyclus is geopend. Wij kijken naar de markt.', 'leden', 'De cyclus is geopend. Wij kijken naar de markt.', '2026-04-20 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · mei 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026')), l.id, 'demo-historie', '2026-04-20 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 1, 'pre_analyse', 'De cyclus is geopend. Wij kijken naar de markt.', 'mens',
       '2026-04-20 17:45:00', 'simon', '2026-04-20 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026'))
  from cyclus where label = 'HISTORIE · mei 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · mei 2026: Het besluit over strikes en inzet loopt.', 'leden', 'Het besluit over strikes en inzet loopt.', '2026-04-21 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · mei 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026')), l.id, 'demo-historie', '2026-04-21 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 1, 'besluit', 'Het besluit over strikes en inzet loopt.', 'mens',
       '2026-04-21 17:45:00', 'simon', '2026-04-21 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026'))
  from cyclus where label = 'HISTORIE · mei 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · mei 2026: De eerste tranche staat in de markt.', 'leden', 'De eerste tranche staat in de markt.', '2026-04-22 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · mei 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026')), l.id, 'demo-historie', '2026-04-22 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 5, 'in_positie', 'De eerste tranche staat in de markt.', 'mens',
       '2026-04-22 17:45:00', 'simon', '2026-04-22 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026'))
  from cyclus where label = 'HISTORIE · mei 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · mei 2026: De zwakste tranche bepaalt de stand.', 'leden', 'De zwakste tranche bepaalt de stand.', '2026-05-04 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · mei 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026')), l.id, 'demo-historie', '2026-05-04 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 4, 'in_positie', 'De zwakste tranche bepaalt de stand.', 'mens',
       '2026-05-04 17:45:00', 'simon', '2026-05-04 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026'))
  from cyclus where label = 'HISTORIE · mei 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · mei 2026: De cyclus is afgerond.', 'leden', 'De cyclus is afgerond.', '2026-05-15 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · mei 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026')), l.id, 'demo-historie', '2026-05-15 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 5, 'afgerond', 'De cyclus is afgerond.', 'mens',
       '2026-05-15 17:45:00', 'simon', '2026-05-15 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · mei 2026'))
  from cyclus where label = 'HISTORIE · mei 2026';

-- ================= HISTORIE · juni 2026 =================
insert into cyclus (label, status, geopend_op, doelexpiratie, afgesloten_op, toelichting)
values ('HISTORIE · juni 2026', 'afgesloten', '2026-05-18', '2026-06-19', '2026-06-19',
        'Demo-historie. Niet echt.');

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 1, 'gesloten', 'OESX 19JUN26 5100 PUT', 5100, '2026-06-19', 3, 38.0, 22,
       'handmatig', 'waardeloos geexpireerd', 38.0, '2026-05-18', '2026-06-19'
  from cyclus where label = 'HISTORIE · juni 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-05-18 17:30:00', 38.0, 37.6, 3, 0),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-05-19 17:30:00', 39.3, 38.9, 2, -3),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-05-20 17:30:00', 40.6, 40.2, 2, -7),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-05-21 17:30:00', 41.9, 41.5, 2, -10),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-05-22 17:30:00', 43.2, 42.8, 2, -14),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-05-25 17:30:00', 44.5, 44.1, 2, -17),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-05-26 17:30:00', 45.8, 45.4, 2, -21),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-05-27 17:30:00', 47.1, 46.7, 2, -24),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-05-28 17:30:00', 48.4, 48.0, 2, -27),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-05-29 17:30:00', 49.7, 49.3, 2, -31),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-01 17:30:00', 51.0, 50.6, 1, -34),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-02 17:30:00', 50.5, 50.1, 1, -33),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-03 17:30:00', 43.4, 43.0, 2, -14),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-04 17:30:00', 36.8, 36.4, 3, 3),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-05 17:30:00', 30.7, 30.3, 3, 19),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-08 17:30:00', 25.1, 24.7, 3, 34),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-09 17:30:00', 20.1, 19.7, 3, 47),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-10 17:30:00', 15.6, 15.2, 4, 59),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-11 17:30:00', 11.6, 11.2, 4, 69),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-12 17:30:00', 8.2, 7.8, 5, 78),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-15 17:30:00', 5.4, 5.0, 5, 86),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-16 17:30:00', 3.1, 2.7, 5, 92),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-17 17:30:00', 1.4, 1.0, 5, 96),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-18 17:30:00', 0.4, 0.1, 5, 99),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5100 PUT'), '2026-06-19 17:30:00', 0.1, 0.1, 5, 100);

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 2, 'gesloten', 'OESX 19JUN26 5000 PUT', 5000, '2026-06-19', 2, 24.0, 12,
       'handmatig', 'waardeloos geexpireerd', 24.0, '2026-05-20', '2026-06-19'
  from cyclus where label = 'HISTORIE · juni 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-05-20 17:30:00', 25.9, 25.5, 2, -8),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-05-21 17:30:00', 24.1, 23.7, 2, 0),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-05-22 17:30:00', 22.4, 22.0, 3, 7),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-05-25 17:30:00', 20.6, 20.2, 3, 14),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-05-26 17:30:00', 19.0, 18.6, 3, 21),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-05-27 17:30:00', 17.4, 17.0, 3, 28),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-05-28 17:30:00', 15.8, 15.4, 3, 34),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-05-29 17:30:00', 14.3, 13.9, 3, 40),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-01 17:30:00', 12.9, 12.5, 3, 46),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-02 17:30:00', 11.5, 11.1, 4, 52),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-03 17:30:00', 10.1, 9.7, 4, 58),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-04 17:30:00', 8.9, 8.5, 4, 63),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-05 17:30:00', 7.7, 7.3, 4, 68),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-08 17:30:00', 6.5, 6.1, 5, 73),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-09 17:30:00', 5.5, 5.1, 5, 77),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-10 17:30:00', 4.5, 4.1, 5, 81),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-11 17:30:00', 3.5, 3.1, 5, 85),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-12 17:30:00', 2.7, 2.3, 5, 89),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-15 17:30:00', 1.9, 1.5, 5, 92),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-16 17:30:00', 1.3, 0.9, 5, 95),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-17 17:30:00', 0.7, 0.3, 5, 97),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-18 17:30:00', 0.3, 0.1, 5, 99),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 5000 PUT'), '2026-06-19 17:30:00', 0.1, 0.1, 5, 100);

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 3, 'gesloten', 'OESX 19JUN26 4900 PUT', 4900, '2026-06-19', 2, 15.0, 9,
       'handmatig', 'waardeloos geexpireerd', 15.0, '2026-05-22', '2026-06-19'
  from cyclus where label = 'HISTORIE · juni 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-05-22 17:30:00', 16.2, 15.8, 2, -8),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-05-25 17:30:00', 15.0, 14.6, 3, 0),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-05-26 17:30:00', 13.8, 13.4, 3, 8),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-05-27 17:30:00', 12.6, 12.2, 3, 16),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-05-28 17:30:00', 11.5, 11.1, 3, 23),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-05-29 17:30:00', 10.4, 10.0, 3, 31),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-01 17:30:00', 9.3, 8.9, 3, 38),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-02 17:30:00', 8.3, 7.9, 3, 45),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-03 17:30:00', 7.3, 6.9, 4, 51),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-04 17:30:00', 6.4, 6.0, 4, 57),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-05 17:30:00', 5.5, 5.1, 4, 63),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-08 17:30:00', 4.7, 4.3, 4, 69),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-09 17:30:00', 3.9, 3.5, 5, 74),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-10 17:30:00', 3.2, 2.8, 5, 79),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-11 17:30:00', 2.5, 2.1, 5, 83),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-12 17:30:00', 1.9, 1.5, 5, 87),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-15 17:30:00', 1.4, 1.0, 5, 91),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-16 17:30:00', 0.9, 0.5, 5, 94),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-17 17:30:00', 0.5, 0.1, 5, 97),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-18 17:30:00', 0.2, 0.1, 5, 99),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026') and contract = 'OESX 19JUN26 4900 PUT'), '2026-06-19 17:30:00', 0.1, 0.1, 5, 99);

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · juni 2026: De cyclus is geopend. Wij kijken naar de markt.', 'leden', 'De cyclus is geopend. Wij kijken naar de markt.', '2026-05-18 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · juni 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026')), l.id, 'demo-historie', '2026-05-18 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 1, 'pre_analyse', 'De cyclus is geopend. Wij kijken naar de markt.', 'mens',
       '2026-05-18 17:45:00', 'simon', '2026-05-18 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026'))
  from cyclus where label = 'HISTORIE · juni 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · juni 2026: Het besluit over strikes en inzet loopt.', 'leden', 'Het besluit over strikes en inzet loopt.', '2026-05-19 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · juni 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026')), l.id, 'demo-historie', '2026-05-19 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 1, 'besluit', 'Het besluit over strikes en inzet loopt.', 'mens',
       '2026-05-19 17:45:00', 'simon', '2026-05-19 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026'))
  from cyclus where label = 'HISTORIE · juni 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · juni 2026: De eerste tranche staat in de markt.', 'leden', 'De eerste tranche staat in de markt.', '2026-05-20 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · juni 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026')), l.id, 'demo-historie', '2026-05-20 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 5, 'in_positie', 'De eerste tranche staat in de markt.', 'mens',
       '2026-05-20 17:45:00', 'simon', '2026-05-20 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026'))
  from cyclus where label = 'HISTORIE · juni 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · juni 2026: De zwakste tranche bepaalt de stand.', 'leden', 'De zwakste tranche bepaalt de stand.', '2026-06-03 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · juni 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026')), l.id, 'demo-historie', '2026-06-03 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 2, 'in_positie', 'De zwakste tranche bepaalt de stand.', 'mens',
       '2026-06-03 17:45:00', 'simon', '2026-06-03 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026'))
  from cyclus where label = 'HISTORIE · juni 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · juni 2026: De cyclus is afgerond.', 'leden', 'De cyclus is afgerond.', '2026-06-19 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · juni 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026')), l.id, 'demo-historie', '2026-06-19 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 5, 'afgerond', 'De cyclus is afgerond.', 'mens',
       '2026-06-19 17:45:00', 'simon', '2026-06-19 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juni 2026'))
  from cyclus where label = 'HISTORIE · juni 2026';

-- ================= HISTORIE · juli 2026 =================
insert into cyclus (label, status, geopend_op, doelexpiratie, afgesloten_op, toelichting)
values ('HISTORIE · juli 2026', 'afgesloten', '2026-06-22', '2026-07-17', '2026-07-17',
        'Demo-historie. Niet echt.');

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 1, 'gesloten', 'OESX 17JUL26 5200 PUT', 5200, '2026-07-17', 3, 31.0, 19,
       'handmatig', 'waardeloos geexpireerd', 31.0, '2026-06-22', '2026-07-17'
  from cyclus where label = 'HISTORIE · juli 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-06-22 17:30:00', 33.5, 33.1, 2, -8),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-06-23 17:30:00', 30.8, 30.4, 3, 1),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-06-24 17:30:00', 28.2, 27.8, 3, 9),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-06-25 17:30:00', 25.6, 25.2, 3, 17),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-06-26 17:30:00', 23.2, 22.8, 3, 25),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-06-29 17:30:00', 20.8, 20.4, 3, 33),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-06-30 17:30:00', 18.6, 18.2, 3, 40),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-07-01 17:30:00', 16.4, 16.0, 3, 47),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-07-02 17:30:00', 14.4, 14.0, 4, 54),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-07-03 17:30:00', 12.4, 12.0, 4, 60),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-07-06 17:30:00', 10.6, 10.2, 4, 66),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-07-07 17:30:00', 8.8, 8.4, 5, 72),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-07-08 17:30:00', 7.2, 6.8, 5, 77),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-07-09 17:30:00', 5.7, 5.3, 5, 82),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-07-10 17:30:00', 4.3, 3.9, 5, 86),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-07-13 17:30:00', 3.1, 2.7, 5, 90),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-07-14 17:30:00', 2.0, 1.6, 5, 94),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-07-15 17:30:00', 1.1, 0.7, 5, 96),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-07-16 17:30:00', 0.4, 0.1, 5, 99),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5200 PUT'), '2026-07-17 17:30:00', 0.1, 0.1, 5, 100);

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 2, 'gesloten', 'OESX 17JUL26 5100 PUT', 5100, '2026-07-17', 2, 20.0, 11,
       'handmatig', 'waardeloos geexpireerd', 20.0, '2026-06-24', '2026-07-17'
  from cyclus where label = 'HISTORIE · juli 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-06-24 17:30:00', 21.6, 21.2, 2, -8),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-06-25 17:30:00', 19.7, 19.3, 3, 2),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-06-26 17:30:00', 17.8, 17.4, 3, 11),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-06-29 17:30:00', 16.0, 15.6, 3, 20),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-06-30 17:30:00', 14.2, 13.8, 3, 29),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-07-01 17:30:00', 12.6, 12.2, 3, 37),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-07-02 17:30:00', 11.0, 10.6, 3, 45),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-07-03 17:30:00', 9.5, 9.1, 4, 52),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-07-06 17:30:00', 8.1, 7.7, 4, 60),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-07-07 17:30:00', 6.7, 6.3, 4, 66),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-07-08 17:30:00', 5.5, 5.1, 5, 72),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-07-09 17:30:00', 4.3, 3.9, 5, 78),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-07-10 17:30:00', 3.3, 2.9, 5, 84),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-07-13 17:30:00', 2.4, 2.0, 5, 88),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-07-14 17:30:00', 1.5, 1.1, 5, 92),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-07-15 17:30:00', 0.8, 0.4, 5, 96),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-07-16 17:30:00', 0.3, 0.1, 5, 98),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026') and contract = 'OESX 17JUL26 5100 PUT'), '2026-07-17 17:30:00', 0.1, 0.1, 5, 99);

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · juli 2026: De cyclus is geopend. Wij kijken naar de markt.', 'leden', 'De cyclus is geopend. Wij kijken naar de markt.', '2026-06-22 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · juli 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026')), l.id, 'demo-historie', '2026-06-22 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 1, 'pre_analyse', 'De cyclus is geopend. Wij kijken naar de markt.', 'mens',
       '2026-06-22 17:45:00', 'simon', '2026-06-22 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026'))
  from cyclus where label = 'HISTORIE · juli 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · juli 2026: Het besluit over strikes en inzet loopt.', 'leden', 'Het besluit over strikes en inzet loopt.', '2026-06-23 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · juli 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026')), l.id, 'demo-historie', '2026-06-23 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 1, 'besluit', 'Het besluit over strikes en inzet loopt.', 'mens',
       '2026-06-23 17:45:00', 'simon', '2026-06-23 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026'))
  from cyclus where label = 'HISTORIE · juli 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · juli 2026: De eerste tranche staat in de markt.', 'leden', 'De eerste tranche staat in de markt.', '2026-06-24 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · juli 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026')), l.id, 'demo-historie', '2026-06-24 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 5, 'in_positie', 'De eerste tranche staat in de markt.', 'mens',
       '2026-06-24 17:45:00', 'simon', '2026-06-24 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026'))
  from cyclus where label = 'HISTORIE · juli 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · juli 2026: De zwakste tranche bepaalt de stand.', 'leden', 'De zwakste tranche bepaalt de stand.', '2026-07-06 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · juli 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026')), l.id, 'demo-historie', '2026-07-06 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 4, 'in_positie', 'De zwakste tranche bepaalt de stand.', 'mens',
       '2026-07-06 17:45:00', 'simon', '2026-07-06 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026'))
  from cyclus where label = 'HISTORIE · juli 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · juli 2026: De cyclus is afgerond.', 'leden', 'De cyclus is afgerond.', '2026-07-17 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · juli 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026')), l.id, 'demo-historie', '2026-07-17 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 5, 'afgerond', 'De cyclus is afgerond.', 'mens',
       '2026-07-17 17:45:00', 'simon', '2026-07-17 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · juli 2026'))
  from cyclus where label = 'HISTORIE · juli 2026';

-- ================= HISTORIE · augustus 2026 =================
insert into cyclus (label, status, geopend_op, doelexpiratie, afgesloten_op, toelichting)
values ('HISTORIE · augustus 2026', 'afgesloten', '2026-07-20', '2026-08-21', '2026-08-21',
        'Demo-historie. Niet echt.');

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 1, 'gesloten', 'OESX 21AUG26 5300 PUT', 5300, '2026-08-21', 3, 40.0, 23,
       'handmatig', 'exitplan uitgevoerd', -21.5, '2026-07-20', '2026-08-03'
  from cyclus where label = 'HISTORIE · augustus 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5300 PUT'), '2026-07-20 17:30:00', 40.0, 39.6, 3, 0),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5300 PUT'), '2026-07-21 17:30:00', 42.2, 41.8, 2, -6),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5300 PUT'), '2026-07-22 17:30:00', 44.3, 43.9, 2, -11),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5300 PUT'), '2026-07-23 17:30:00', 46.5, 46.1, 2, -16),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5300 PUT'), '2026-07-24 17:30:00', 48.6, 48.2, 2, -22),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5300 PUT'), '2026-07-27 17:30:00', 50.8, 50.4, 1, -27),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5300 PUT'), '2026-07-28 17:30:00', 52.9, 52.5, 1, -32),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5300 PUT'), '2026-07-29 17:30:00', 55.1, 54.7, 1, -38),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5300 PUT'), '2026-07-30 17:30:00', 57.2, 56.8, 1, -43),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5300 PUT'), '2026-07-31 17:30:00', 59.4, 59.0, 1, -48),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5300 PUT'), '2026-08-03 17:30:00', 61.5, 61.1, 0, -54);

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 2, 'gesloten', 'OESX 21AUG26 5200 PUT', 5200, '2026-08-21', 2, 26.0, 13,
       'handmatig', 'waardeloos geexpireerd', 26.0, '2026-07-22', '2026-08-21'
  from cyclus where label = 'HISTORIE · augustus 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-07-22 17:30:00', 26.0, 25.6, 3, 0),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-07-23 17:30:00', 28.6, 28.2, 2, -10),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-07-24 17:30:00', 31.3, 30.9, 2, -20),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-07-27 17:30:00', 33.9, 33.5, 2, -30),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-07-28 17:30:00', 36.5, 36.1, 2, -40),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-07-29 17:30:00', 39.1, 38.7, 2, -50),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-07-30 17:30:00', 41.8, 41.4, 2, -61),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-07-31 17:30:00', 44.4, 44.0, 2, -71),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-03 17:30:00', 47.0, 46.6, 2, -81),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-04 17:30:00', 49.6, 49.2, 2, -91),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-05 17:30:00', 51.2, 50.8, 1, -97),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-06 17:30:00', 43.4, 43.0, 2, -67),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-07 17:30:00', 36.2, 35.8, 2, -39),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-10 17:30:00', 29.6, 29.2, 2, -14),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-11 17:30:00', 23.7, 23.3, 3, 9),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-12 17:30:00', 18.4, 18.0, 3, 29),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-13 17:30:00', 13.7, 13.3, 3, 47),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-14 17:30:00', 9.7, 9.3, 4, 63),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-17 17:30:00', 6.3, 5.9, 5, 76),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-18 17:30:00', 3.7, 3.3, 5, 86),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-19 17:30:00', 1.7, 1.3, 5, 93),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-20 17:30:00', 0.5, 0.1, 5, 98),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5200 PUT'), '2026-08-21 17:30:00', 0.1, 0.1, 5, 100);

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 3, 'gesloten', 'OESX 21AUG26 5100 PUT', 5100, '2026-08-21', 2, 16.0, 9,
       'handmatig', 'waardeloos geexpireerd', 16.0, '2026-07-24', '2026-08-21'
  from cyclus where label = 'HISTORIE · augustus 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-07-24 17:30:00', 17.3, 16.9, 2, -8),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-07-27 17:30:00', 16.0, 15.6, 3, 0),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-07-28 17:30:00', 14.7, 14.3, 3, 8),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-07-29 17:30:00', 13.4, 13.0, 3, 16),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-07-30 17:30:00', 12.2, 11.8, 3, 24),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-07-31 17:30:00', 11.1, 10.7, 3, 31),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-03 17:30:00', 9.9, 9.5, 3, 38),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-04 17:30:00', 8.9, 8.5, 3, 44),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-05 17:30:00', 7.8, 7.4, 4, 51),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-06 17:30:00', 6.9, 6.5, 4, 57),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-07 17:30:00', 5.9, 5.5, 4, 63),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-10 17:30:00', 5.0, 4.6, 4, 69),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-11 17:30:00', 4.2, 3.8, 5, 74),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-12 17:30:00', 3.4, 3.0, 5, 79),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-13 17:30:00', 2.7, 2.3, 5, 83),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-14 17:30:00', 2.1, 1.7, 5, 87),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-17 17:30:00', 1.5, 1.1, 5, 91),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-18 17:30:00', 1.0, 0.6, 5, 94),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-19 17:30:00', 0.5, 0.1, 5, 97),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-20 17:30:00', 0.2, 0.1, 5, 99),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026') and contract = 'OESX 21AUG26 5100 PUT'), '2026-08-21 17:30:00', 0.1, 0.1, 5, 99);

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · augustus 2026: De cyclus is geopend. Wij kijken naar de markt.', 'leden', 'De cyclus is geopend. Wij kijken naar de markt.', '2026-07-20 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · augustus 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026')), l.id, 'demo-historie', '2026-07-20 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 1, 'pre_analyse', 'De cyclus is geopend. Wij kijken naar de markt.', 'mens',
       '2026-07-20 17:45:00', 'simon', '2026-07-20 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026'))
  from cyclus where label = 'HISTORIE · augustus 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · augustus 2026: Het besluit over strikes en inzet loopt.', 'leden', 'Het besluit over strikes en inzet loopt.', '2026-07-21 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · augustus 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026')), l.id, 'demo-historie', '2026-07-21 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 1, 'besluit', 'Het besluit over strikes en inzet loopt.', 'mens',
       '2026-07-21 17:45:00', 'simon', '2026-07-21 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026'))
  from cyclus where label = 'HISTORIE · augustus 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · augustus 2026: De eerste tranche staat in de markt.', 'leden', 'De eerste tranche staat in de markt.', '2026-07-22 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · augustus 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026')), l.id, 'demo-historie', '2026-07-22 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 5, 'in_positie', 'De eerste tranche staat in de markt.', 'mens',
       '2026-07-22 17:45:00', 'simon', '2026-07-22 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026'))
  from cyclus where label = 'HISTORIE · augustus 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · augustus 2026: De zwakste tranche bepaalt de stand.', 'leden', 'De zwakste tranche bepaalt de stand.', '2026-08-05 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · augustus 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026')), l.id, 'demo-historie', '2026-08-05 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 1, 'in_positie', 'De zwakste tranche bepaalt de stand.', 'mens',
       '2026-08-05 17:45:00', 'simon', '2026-08-05 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026'))
  from cyclus where label = 'HISTORIE · augustus 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · augustus 2026: De cyclus is afgerond.', 'leden', 'De cyclus is afgerond.', '2026-08-21 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · augustus 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026')), l.id, 'demo-historie', '2026-08-21 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 5, 'afgerond', 'De cyclus is afgerond.', 'mens',
       '2026-08-21 17:45:00', 'simon', '2026-08-21 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · augustus 2026'))
  from cyclus where label = 'HISTORIE · augustus 2026';

-- ================= HISTORIE · september 2026 =================
insert into cyclus (label, status, geopend_op, doelexpiratie, afgesloten_op, toelichting)
values ('HISTORIE · september 2026', 'afgesloten', '2026-08-24', '2026-09-18', '2026-09-18',
        'Demo-historie. Niet echt.');

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 1, 'gesloten', 'OESX 18SEP26 5400 PUT', 5400, '2026-09-18', 3, 33.0, 20,
       'handmatig', 'waardeloos geexpireerd', 33.0, '2026-08-24', '2026-09-18'
  from cyclus where label = 'HISTORIE · september 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-08-24 17:30:00', 35.6, 35.2, 2, -8),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-08-25 17:30:00', 32.8, 32.4, 3, 1),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-08-26 17:30:00', 30.0, 29.6, 3, 9),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-08-27 17:30:00', 27.3, 26.9, 3, 17),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-08-28 17:30:00', 24.7, 24.3, 3, 25),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-08-31 17:30:00', 22.2, 21.8, 3, 33),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-01 17:30:00', 19.8, 19.4, 3, 40),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-02 17:30:00', 17.5, 17.1, 3, 47),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-03 17:30:00', 15.3, 14.9, 4, 54),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-04 17:30:00', 13.2, 12.8, 4, 60),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-07 17:30:00', 11.2, 10.8, 4, 66),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-08 17:30:00', 9.4, 9.0, 5, 72),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-09 17:30:00', 7.7, 7.3, 5, 77),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-10 17:30:00', 6.1, 5.7, 5, 82),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-11 17:30:00', 4.6, 4.2, 5, 86),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-14 17:30:00', 3.3, 2.9, 5, 90),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-15 17:30:00', 2.1, 1.7, 5, 94),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-16 17:30:00', 1.2, 0.8, 5, 96),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-17 17:30:00', 0.4, 0.1, 5, 99),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5400 PUT'), '2026-09-18 17:30:00', 0.1, 0.1, 5, 100);

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 2, 'gesloten', 'OESX 18SEP26 5300 PUT', 5300, '2026-09-18', 2, 22.0, 12,
       'handmatig', 'waardeloos geexpireerd', 22.0, '2026-08-26', '2026-09-18'
  from cyclus where label = 'HISTORIE · september 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-08-26 17:30:00', 23.8, 23.4, 2, -8),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-08-27 17:30:00', 21.6, 21.2, 3, 2),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-08-28 17:30:00', 19.6, 19.2, 3, 11),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-08-31 17:30:00', 17.6, 17.2, 3, 20),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-01 17:30:00', 15.7, 15.3, 3, 29),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-02 17:30:00', 13.8, 13.4, 3, 37),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-03 17:30:00', 12.1, 11.7, 3, 45),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-04 17:30:00', 10.4, 10.0, 4, 53),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-07 17:30:00', 8.9, 8.5, 4, 60),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-08 17:30:00', 7.4, 7.0, 4, 66),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-09 17:30:00', 6.0, 5.6, 5, 73),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-10 17:30:00', 4.8, 4.4, 5, 78),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-11 17:30:00', 3.6, 3.2, 5, 84),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-14 17:30:00', 2.6, 2.2, 5, 88),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-15 17:30:00', 1.7, 1.3, 5, 92),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-16 17:30:00', 0.9, 0.5, 5, 96),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-17 17:30:00', 0.3, 0.1, 5, 99),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5300 PUT'), '2026-09-18 17:30:00', 0.1, 0.1, 5, 100);

insert into positie (cyclus, tranche, status, contract, strike, expiratiedatum, aantal,
                     ontvangen_premie_pt, inzet_pct, herkomst, uitkomst, resultaat_pt,
                     uitvoering_op, sluittijdstip)
select id, 3, 'gesloten', 'OESX 18SEP26 5200 PUT', 5200, '2026-09-18', 2, 14.0, 9,
       'handmatig', 'waardeloos geexpireerd', 14.0, '2026-08-28', '2026-09-18'
  from cyclus where label = 'HISTORIE · september 2026';
insert into positiemeting (positie, moment, ask, bod, stand, binnen) values
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-08-28 17:30:00', 15.1, 14.7, 2, -8),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-08-31 17:30:00', 13.6, 13.2, 3, 3),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-01 17:30:00', 12.1, 11.7, 3, 14),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-02 17:30:00', 10.7, 10.3, 3, 24),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-03 17:30:00', 9.3, 8.9, 3, 34),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-04 17:30:00', 8.1, 7.7, 3, 42),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-07 17:30:00', 6.9, 6.5, 4, 51),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-08 17:30:00', 5.7, 5.3, 4, 59),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-09 17:30:00', 4.7, 4.3, 4, 66),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-10 17:30:00', 3.7, 3.3, 5, 74),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-11 17:30:00', 2.8, 2.4, 5, 80),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-14 17:30:00', 2.0, 1.6, 5, 86),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-15 17:30:00', 1.3, 0.9, 5, 91),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-16 17:30:00', 0.7, 0.3, 5, 95),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-17 17:30:00', 0.3, 0.1, 5, 98),
  ((select id from positie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026') and contract = 'OESX 18SEP26 5200 PUT'), '2026-09-18 17:30:00', 0.1, 0.1, 5, 99);

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · september 2026: De cyclus is geopend. Wij kijken naar de markt.', 'leden', 'De cyclus is geopend. Wij kijken naar de markt.', '2026-08-24 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · september 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026')), l.id, 'demo-historie', '2026-08-24 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 1, 'pre_analyse', 'De cyclus is geopend. Wij kijken naar de markt.', 'mens',
       '2026-08-24 17:45:00', 'simon', '2026-08-24 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026'))
  from cyclus where label = 'HISTORIE · september 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · september 2026: Het besluit over strikes en inzet loopt.', 'leden', 'Het besluit over strikes en inzet loopt.', '2026-08-25 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · september 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026')), l.id, 'demo-historie', '2026-08-25 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 1, 'besluit', 'Het besluit over strikes en inzet loopt.', 'mens',
       '2026-08-25 17:45:00', 'simon', '2026-08-25 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026'))
  from cyclus where label = 'HISTORIE · september 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · september 2026: De eerste tranche staat in de markt.', 'leden', 'De eerste tranche staat in de markt.', '2026-08-26 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · september 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026')), l.id, 'demo-historie', '2026-08-26 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 5, 'in_positie', 'De eerste tranche staat in de markt.', 'mens',
       '2026-08-26 17:45:00', 'simon', '2026-08-26 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026'))
  from cyclus where label = 'HISTORIE · september 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · september 2026: De zwakste tranche bepaalt de stand.', 'leden', 'De zwakste tranche bepaalt de stand.', '2026-09-07 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · september 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026')), l.id, 'demo-historie', '2026-09-07 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 4, 'in_positie', 'De zwakste tranche bepaalt de stand.', 'mens',
       '2026-09-07 17:45:00', 'simon', '2026-09-07 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026'))
  from cyclus where label = 'HISTORIE · september 2026';

insert into publicatie (cyclus, soort, status, titel, kanaal, tekst, verstuurd_op, verstuurd_door, aangemaakt_door)
select id, 'barometer', 'verstuurd', 'HISTORIE · september 2026: De cyclus is afgerond.', 'leden', 'De cyclus is afgerond.', '2026-09-18 18:00:00', 'simon', 'simon'
  from cyclus where label = 'HISTORIE · september 2026';
insert into publicatie_ontvanger (publicatie, lid, reden, bezorgd_op)
  select (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026')), l.id, 'demo-historie', '2026-09-18 18:00:00'
    from lid l where l.email like '%@delta-historie.test';
insert into barometerstand (cyclus, stand, venster, reden, herkomst, vastgesteld_op, vastgesteld_door, gepubliceerd_op, publicatie)
select id, 5, 'afgerond', 'De cyclus is afgerond.', 'mens',
       '2026-09-18 17:45:00', 'simon', '2026-09-18 18:00:00', (select max(id) from publicatie where cyclus in (select id from cyclus where label = 'HISTORIE · september 2026'))
  from cyclus where label = 'HISTORIE · september 2026';

